"""Mock-only integration tests. These tests never call OpenAI or use a real key."""
from dataclasses import replace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import http.client
import json
import shutil
import sys
import tempfile
import threading
import time
import unittest

import server

BASE = Path(__file__).resolve().parent
TEST_ROOT = BASE / ".test-temp"
session = next((p for p in BASE.parents if (p / ".codex-session.json").is_file()), None)
if session:
    sys.path.insert(0, str(session.parent / "session7-AI游戏报告审阅"))
    from session_workspace import assert_session_output
    assert_session_output(__file__, TEST_ROOT, thread_id="01a1f6b3-83ed-7ac1-ba57-c0a2aa1f075b")


class MockOpenAI(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    calls = []
    mode = "normal"

    def log_message(self, *_args):
        pass

    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        type(self).calls.append((self.path, self.headers.get("Authorization"), payload))
        if type(self).mode == "error":
            data = b'{"error":{"message":"sensitive upstream debug sk-test-secret","code":"bad_key"}}'
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if type(self).mode == "redirect":
            self.send_response(307)
            self.send_header("Location", "http://127.0.0.1:1/key-must-not-follow")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if payload.get("stream"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Connection", "close")
            self.end_headers()
            self.close_connection = True
            frames = [
                'data: {"choices":[{"delta":{"content":"你"}}]}\n\n'.encode(),
                'data: {"choices":[{"delta":{"content":"好"}}]}\n\n'.encode(),
                b'data: [DONE]\n\n',
            ]
            if type(self).mode == "cancel":
                frames = frames[:1] * 100
            if type(self).mode == "truncated":
                frames = frames[:1]
            try:
                for frame in frames:
                    # Split one UTF-8 character and event between network writes.
                    for part in [frame[:18], frame[18:]]:
                        self.wfile.write(part)
                        self.wfile.flush()
                        time.sleep(0.005)
            except OSError:
                pass
            return
        body = json.dumps({"id": "mock-completion", "choices": [{"message": {"role": "assistant", "content": "mock answer"}}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class ProxyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        TEST_ROOT.mkdir(exist_ok=True)
        cls.temp = tempfile.TemporaryDirectory(prefix="proxy-", dir=TEST_ROOT)
        cls.public = Path(cls.temp.name) / "public"
        cls.public.mkdir()
        (cls.public / "index.html").write_text("<html>same layout</html>", encoding="utf-8")
        (cls.public / ".private").write_text("hidden", encoding="utf-8")
        (Path(cls.temp.name) / "secret.txt").write_text("outside public", encoding="utf-8")
        cls.upstream = ThreadingHTTPServer(("127.0.0.1", 0), MockOpenAI)
        cls.upstream.daemon_threads = True
        cls.up_thread = threading.Thread(target=cls.upstream.serve_forever, daemon=True)
        cls.up_thread.start()
        cls.config = server.Config(api_key="sk-test-secret", model="gpt-4.1-mini", models=("gpt-4.1-mini", "test-second"), base_url=f"http://127.0.0.1:{cls.upstream.server_port}/v1", host="127.0.0.1", port=0, public_dir=cls.public, concurrency=1, timeout=2)
        cls.proxy = server.make_server(cls.config)
        cls.proxy_thread = threading.Thread(target=cls.proxy.serve_forever, daemon=True)
        cls.proxy_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.proxy.shutdown()
        cls.upstream.shutdown()
        cls.proxy.server_close()
        cls.upstream.server_close()
        cls.temp.cleanup()
        try:
            TEST_ROOT.rmdir()
        except OSError:
            pass

    def setUp(self):
        MockOpenAI.mode = "normal"
        MockOpenAI.calls.clear()

    def request(self, method, path, payload=None, headers=None, app=None):
        app = app or self.proxy
        conn = http.client.HTTPConnection("127.0.0.1", app.server_port, timeout=3)
        h = {"X-Second-Curve-Token": app.csrf_token, "Content-Type": "application/json"}
        h.update(headers or {})
        raw = json.dumps(payload).encode() if isinstance(payload, (dict, list)) else payload
        conn.request(method, path, body=raw, headers=h)
        response = conn.getresponse()
        data = response.read()
        status = response.status
        response_headers = dict(response.getheaders())
        conn.close()
        return status, data, response_headers

    def body(self, **extra):
        return {"model": "gpt-4.1-mini", "messages": [{"role": "user", "content": "hello"}], **extra}

    def test_models_and_key_are_separated(self):
        status, raw, _ = self.request("GET", "/api/models")
        data = json.loads(raw)
        self.assertEqual(status, 200)
        self.assertEqual([m["id"] for m in data["data"]], list(self.config.models))
        self.assertTrue(data["configured"])
        self.assertEqual(data["csrf_token"], self.proxy.csrf_token)
        self.assertNotIn(b"sk-test-secret", raw)
        self.assertEqual(MockOpenAI.calls, [])

    def test_nonstream_forward_and_output_limit(self):
        status, raw, _ = self.request("POST", "/api/chat/completions", self.body(max_tokens=99999))
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)["choices"][0]["message"]["content"], "mock answer")
        path, auth, payload = MockOpenAI.calls[0]
        self.assertEqual(path, "/v1/chat/completions")
        self.assertEqual(auth, "Bearer sk-test-secret")
        self.assertEqual(payload["max_completion_tokens"], 4096)
        self.assertNotIn("max_tokens", payload)
        self.assertFalse(payload["stream"])

    def test_reasoning_models_use_compatible_parameters(self):
        app = server.make_server(replace(self.config, model="gpt-5-mini", models=("gpt-5-mini",)))
        thread = threading.Thread(target=app.serve_forever, daemon=True)
        thread.start()
        try:
            status, _, _ = self.request("POST", "/api/chat/completions", self.body(model="gpt-5-mini", temperature=.8, max_tokens=2048), app=app)
            self.assertEqual(status, 200)
            payload = MockOpenAI.calls[0][2]
            self.assertNotIn("temperature", payload)
            self.assertNotIn("max_tokens", payload)
            self.assertEqual(payload["max_completion_tokens"], 2048)
        finally:
            app.shutdown()
            app.server_close()

    def test_split_sse_is_preserved(self):
        status, raw, headers = self.request("POST", "/api/chat/completions", self.body(stream=True))
        self.assertEqual(status, 200)
        self.assertIn("text/event-stream", headers["Content-Type"])
        self.assertIn('"content":"你"', raw.decode())
        self.assertIn('"content":"好"', raw.decode())
        self.assertIn(b"data: [DONE]", raw)

    def test_missing_key_no_upstream_call(self):
        app = server.make_server(replace(self.config, api_key=""))
        thread = threading.Thread(target=app.serve_forever, daemon=True)
        thread.start()
        try:
            status, raw, _ = self.request("POST", "/api/chat/completions", self.body(), app=app)
            self.assertEqual(status, 503)
            self.assertEqual(json.loads(raw)["error"]["code"], "missing_api_key")
            self.assertEqual(MockOpenAI.calls, [])
        finally:
            app.shutdown()
            app.server_close()

    def test_truncated_stream_reports_error(self):
        MockOpenAI.mode = "truncated"
        status, raw, _ = self.request("POST", "/api/chat/completions", self.body(stream=True))
        self.assertEqual(status, 200)
        self.assertIn(b"upstream_interrupted", raw)
        self.assertNotIn(b"[DONE]", raw)

    def test_bad_model_and_injection_fields_are_rejected(self):
        for payload in [self.body(model="unlisted"), self.body(messages=[]), self.body(messages=[{"role": "user", "content": [{"type": "image_url", "image_url": {"url": "http://bad"}}]}]), self.body(stream="true"), self.body(max_tokens=-1), self.body(temperature=float("nan"))]:
            with self.subTest(payload=payload):
                status, _, _ = self.request("POST", "/api/chat/completions", payload)
                self.assertEqual(status, 400)
        self.assertEqual(MockOpenAI.calls, [])

    def test_unapproved_parameters_never_reach_upstream(self):
        status, _, _ = self.request("POST", "/api/chat/completions", self.body(base_url="http://bad", tools=[{}], store=True, n=100))
        self.assertEqual(status, 200)
        self.assertFalse({"base_url", "tools", "store", "n"} & MockOpenAI.calls[0][2].keys())

    def test_session_and_source_checks(self):
        cases = [{"X-Second-Curve-Token": "wrong"}, {"Origin": "https://evil.example"}, {"Host": "evil.example"}, {"Sec-Fetch-Site": "cross-site"}]
        for headers in cases:
            with self.subTest(headers=headers):
                status, _, response_headers = self.request("POST", "/api/chat/completions", self.body(), headers)
                self.assertEqual(status, 403)
                self.assertNotIn("Access-Control-Allow-Origin", response_headers)
        self.assertEqual(MockOpenAI.calls, [])

    def test_static_root_cannot_serve_secrets(self):
        status, raw, _ = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"same layout", raw)
        for path in ["/../secret.txt", "/%2e%2e/secret.txt", "/.private", "/server.py", "/api/unknown"]:
            self.assertEqual(self.request("GET", path)[0], 404)

    def test_error_is_sanitized_and_redirect_not_followed(self):
        MockOpenAI.mode = "error"
        status, raw, _ = self.request("POST", "/api/chat/completions", self.body())
        self.assertEqual(status, 401)
        self.assertNotIn(b"sk-test-secret", raw)
        self.assertNotIn(b"sensitive upstream", raw)
        MockOpenAI.mode = "redirect"
        self.assertEqual(self.request("POST", "/api/chat/completions", self.body())[0], 502)

    def test_busy_slot_does_not_forward(self):
        self.proxy.slots.acquire()
        try:
            self.assertEqual(self.request("POST", "/api/chat/completions", self.body())[0], 429)
            self.assertEqual(MockOpenAI.calls, [])
        finally:
            self.proxy.slots.release()

    def test_client_cancellation_releases_slot(self):
        MockOpenAI.mode = "cancel"
        conn = http.client.HTTPConnection("127.0.0.1", self.proxy.server_port, timeout=3)
        conn.request("POST", "/api/chat/completions", json.dumps(self.body(stream=True)), {"Content-Type": "application/json", "X-Second-Curve-Token": self.proxy.csrf_token})
        response = conn.getresponse()
        self.assertEqual(response.status, 200)
        response.read(20)
        response.close()
        conn.close()
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            if self.proxy.slots.acquire(blocking=False):
                self.proxy.slots.release()
                break
            time.sleep(0.02)
        else:
            self.fail("Request slot was not released after browser disconnected")


if __name__ == "__main__":
    unittest.main(verbosity=2)
