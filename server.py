"""Second Curve: same-origin static app and a small server-side OpenAI proxy.

No third-party packages are required. Set OPENAI_API_KEY in this process's
environment, then run ``python server.py``. The key never enters the HTML.
"""
from __future__ import annotations

from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import http.client
import json
import mimetypes
import os
import re
import secrets
import socket
import threading
from urllib import error, parse, request

BASE = Path(__file__).resolve().parent
MAX_BODY = 2 * 1024 * 1024
MODEL_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$")


@dataclass(frozen=True)
class Config:
    api_key: str = ""
    model: str = "gpt-4.1-mini"
    models: tuple[str, ...] = ("gpt-4.1-mini",)
    base_url: str = "https://api.openai.com/v1"
    host: str = "127.0.0.1"
    port: int = 8787
    app_origin: str = ""
    public_dir: Path = BASE / "public"
    timeout: float = 90
    concurrency: int = 4
    max_output_tokens: int = 4096

    @classmethod
    def from_env(cls) -> "Config":
        model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini").strip()
        models = tuple(dict.fromkeys([model] + [m.strip() for m in os.getenv("OPENAI_MODELS", "").split(",") if m.strip()]))
        if not all(MODEL_ID.fullmatch(m) for m in models):
            raise ValueError("OPENAI_MODEL / OPENAI_MODELS 中有无效模型名称")
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")
        u = parse.urlsplit(base_url)
        local = u.hostname in {"localhost", "127.0.0.1", "::1"}
        if u.username or u.password or u.query or u.fragment or not u.hostname or (u.scheme != "https" and not (u.scheme == "http" and local)):
            raise ValueError("OPENAI_BASE_URL 需使用 HTTPS（本机测试服务可使用 HTTP）")
        host = os.getenv("HOST", "127.0.0.1").strip()
        origin = os.getenv("APP_ORIGIN", "").strip().rstrip("/")
        if origin:
            o = parse.urlsplit(origin)
            if o.scheme not in {"http", "https"} or not o.netloc or o.path or o.query or o.fragment or o.username or o.password:
                raise ValueError("APP_ORIGIN 只填写网页来源，如 https://example.com")
        elif host not in {"127.0.0.1", "localhost", "::1"}:
            raise ValueError("非本机监听必须设置 APP_ORIGIN，并在部署端配置访问控制")
        return cls(
            api_key=os.getenv("OPENAI_API_KEY", "").strip(), model=model, models=models,
            base_url=base_url, host=host, port=int(os.getenv("PORT", "8787")),
            app_origin=origin, public_dir=BASE / "public",
            timeout=max(5, min(float(os.getenv("OPENAI_TIMEOUT", "90")), 300)),
            concurrency=max(1, min(int(os.getenv("OPENAI_CONCURRENCY", "4")), 16)),
            max_output_tokens=max(64, min(int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "4096")), 32768)),
        )


class NoRedirect(request.HTTPRedirectHandler):
    # A configured upstream must never redirect the Authorization header.
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class AppServer(ThreadingHTTPServer):
    daemon_threads = True
    block_on_close = False

    def __init__(self, address, config: Config):
        self.config = config
        self.csrf_token = secrets.token_urlsafe(32)
        self.slots = threading.BoundedSemaphore(config.concurrency)
        self.opener = request.build_opener(NoRedirect())
        super().__init__(address, Handler)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "SecondCurve"
    sys_version = ""

    def setup(self):
        super().setup()
        self.connection.settimeout(20)

    def log_message(self, _format, *args):
        # Do not log bodies, headers, query strings, credentials, or upstream data.
        return

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def json_reply(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def fail(self, status, message, code="request_error"):
        self.json_reply(status, {"error": {"message": message, "type": "proxy_error", "code": code}})

    def allowed_hosts(self):
        config = self.server.config
        if config.app_origin:
            return {parse.urlsplit(config.app_origin).netloc.lower()}
        port = self.server.server_address[1]
        return {f"127.0.0.1:{port}", f"localhost:{port}", f"[::1]:{port}"}

    def valid_source(self):
        host = self.headers.get("Host", "").lower()
        if host not in self.allowed_hosts():
            self.fail(403, "请求来源不受信任。", "untrusted_host")
            return False
        origin = self.headers.get("Origin")
        allowed_origin = self.server.config.app_origin
        if origin and (origin != allowed_origin if allowed_origin else parse.urlsplit(origin).netloc.lower() != host or parse.urlsplit(origin).scheme != "http"):
            self.fail(403, "仅允许网页同源请求。", "cross_origin")
            return False
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            self.fail(403, "仅允许网页同源请求。", "cross_origin")
            return False
        return True

    def do_OPTIONS(self):
        self.fail(403, "不接受跨站调用。", "cross_origin")

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self.valid_source():
            return
        path = parse.urlsplit(self.path).path
        if path in {"/api/models", "/api/config"}:
            config = self.server.config
            self.json_reply(200, {
                "object": "list", "data": [{"id": model, "object": "model", "owned_by": "openai", "name": model} for model in config.models],
                "configured": bool(config.api_key), "default_model": config.model,
                "csrf_token": self.server.csrf_token,
            })
        elif path.startswith("/api/"):
            self.fail(404, "接口不存在。", "not_found")
        else:
            self.static_file(path)

    def static_file(self, raw_path):
        public = self.server.config.public_dir.resolve()
        path = parse.unquote(raw_path)
        if "\x00" in path or "\\" in path:
            self.fail(404, "文件不存在。", "not_found")
            return
        target = (public / (path.lstrip("/") or "index.html")).resolve()
        if not target.is_relative_to(public) or any(p.startswith(".") for p in Path(path).parts if p not in {"/", ".", ".."}) or not target.is_file():
            self.fail(404, "文件不存在。", "not_found")
            return
        kind = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", kind + ("; charset=utf-8" if kind.startswith("text/") or kind in {"application/javascript", "application/json"} else ""))
        self.send_header("Content-Length", str(target.stat().st_size))
        self.end_headers()
        if self.command != "HEAD":
            with target.open("rb") as stream:
                while data := stream.read(65536):
                    self.wfile.write(data)

    def do_POST(self):
        # Failed requests close the connection without parsing an untrusted body.
        self.close_connection = True
        if not self.valid_source():
            return
        if parse.urlsplit(self.path).path != "/api/chat/completions":
            self.fail(404, "接口不存在。", "not_found")
            return
        token = self.headers.get("X-Second-Curve-Token", "")
        if not secrets.compare_digest(token, self.server.csrf_token):
            self.fail(403, "页面连接已过期，请刷新后重试。", "invalid_session")
            return
        if not self.server.config.api_key:
            self.fail(503, "尚未配置 OPENAI_API_KEY，请在服务端设置后重启。", "missing_api_key")
            return
        if self.headers.get("Transfer-Encoding") or self.headers.get_content_type() != "application/json":
            self.fail(415, "请发送 JSON 请求。", "invalid_content_type")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length < 1 or length > MAX_BODY:
            self.fail(413 if length > MAX_BODY else 400, "请求内容为空或过大。", "invalid_body_size")
            return
        try:
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError("incomplete body")
            payload = self.validate_payload(json.loads(raw))
        except (ValueError, TypeError, UnicodeDecodeError, socket.timeout):
            self.fail(400, "请求格式无效，请检查消息、模型和参数。", "invalid_request")
            return
        if not self.server.slots.acquire(blocking=False):
            self.fail(429, "同时请求过多，请稍后重试。", "concurrency_limit")
            return
        try:
            self.forward(payload)
        finally:
            self.server.slots.release()

    def validate_payload(self, data):
        if not isinstance(data, dict):
            raise ValueError()
        config = self.server.config
        model = data.get("model", config.model)
        if model not in config.models:
            raise ValueError()
        messages = data.get("messages")
        if not isinstance(messages, list) or not 1 <= len(messages) <= 128:
            raise ValueError()
        validated = []
        chars = 0
        for msg in messages:
            if not isinstance(msg, dict) or msg.get("role") not in {"system", "developer", "user", "assistant"}:
                raise ValueError()
            content = msg.get("content")
            if isinstance(content, list):
                if not content or any(not isinstance(p, dict) or p.get("type") != "text" or not isinstance(p.get("text"), str) for p in content):
                    raise ValueError()
                content = [{"type": "text", "text": p["text"]} for p in content]
                chars += sum(len(p["text"]) for p in content)
            elif isinstance(content, str):
                chars += len(content)
            else:
                raise ValueError()
            validated.append({"role": msg["role"], "content": content})
        if chars > 500000:
            raise ValueError()
        stream = data.get("stream", False)
        if not isinstance(stream, bool):
            raise ValueError()
        result = {"model": model, "messages": validated, "stream": stream}
        token_name = "max_completion_tokens" if "max_completion_tokens" in data else "max_tokens"
        tokens = data.get(token_name, config.max_output_tokens)
        if isinstance(tokens, bool) or not isinstance(tokens, int) or tokens < 1:
            raise ValueError()
        result['max_completion_tokens'] = min(tokens, config.max_output_tokens)
        reasoning_model = bool(re.match(r'^(?:gpt-[56](?:[.\-]|$)|o[134](?:[.\-]|$))', model))
        for key, low, high in [("temperature", 0, 2), ("top_p", 0, 1), ("presence_penalty", -2, 2), ("frequency_penalty", -2, 2)]:
            if key in data:
                value = data[key]
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not low <= value <= high:
                    raise ValueError()
                # Original consumers send .3/.8; reasoning models use defaults.
                if not reasoning_model:
                    result[key] = value
        response_format = data.get("response_format")
        if response_format is not None:
            if not isinstance(response_format, dict) or response_format.get("type") not in {"text", "json_object"}:
                raise ValueError()
            result["response_format"] = {"type": response_format["type"]}
        return result

    def forward(self, payload):
        config = self.server.config
        req = request.Request(config.base_url + "/chat/completions", method="POST", data=json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8"), headers={
            "Authorization": "Bearer " + config.api_key,
            "Content-Type": "application/json", "Accept": "text/event-stream" if payload["stream"] else "application/json",
        })
        sent_headers = False
        try:
            with self.server.opener.open(req, timeout=config.timeout) as upstream:
                if payload["stream"]:
                    if "text/event-stream" not in upstream.headers.get("Content-Type", ""):
                        self.fail(502, "OpenAI 未返回有效的流式响应。", "invalid_upstream_response")
                        return
                    self.send_response(200)
                    self.send_header("Content-Type", "text/event-stream; charset=utf-8")
                    self.send_header("Connection", "close")
                    self.send_header("X-Accel-Buffering", "no")
                    self.end_headers()
                    sent_headers = True
                    self.forward_sse(upstream)
                else:
                    raw = upstream.read(16 * 1024 * 1024 + 1)
                    if len(raw) > 16 * 1024 * 1024:
                        raise ValueError()
                    response = json.loads(raw)
                    if not isinstance(response, dict) or not isinstance(response.get("choices"), list):
                        raise ValueError()
                    self.json_reply(200, response)
        except error.HTTPError as exc:
            status = exc.code if exc.code in {400, 401, 403, 404, 429} else 502
            messages = {
                400: "OpenAI 拒绝了请求，请检查模型及参数。", 401: "OpenAI API Key 无效，请检查服务端配置。",
                403: "当前 OpenAI 项目或地区无权使用此模型。", 404: "OpenAI 模型或接口不存在，请检查服务端配置。",
                429: "OpenAI 额度不足或请求过于频繁，请检查账户额度后重试。",
            }
            self.fail(status, messages.get(status, "OpenAI 服务暂时不可用，请稍后重试。"), "upstream_error")
            exc.close()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        except (error.URLError, TimeoutError, socket.timeout, http.client.HTTPException, ValueError, OSError):
            if sent_headers:
                try:
                    frame = {"error": {"message": "与 OpenAI 的连接中断，请重试。", "type": "proxy_error", "code": "upstream_interrupted"}}
                    self.wfile.write(("data: " + json.dumps(frame, ensure_ascii=False) + "\n\n").encode("utf-8"))
                    self.wfile.flush()
                except OSError:
                    pass
            else:
                self.fail(502, "无法连接 OpenAI，请检查服务端网络及接口配置。", "upstream_unavailable")

    def forward_sse(self, upstream):
        """Relay complete SSE events, including UTF-8 split across TCP chunks.

        Detect a truncated stream and sanitize upstream error frames instead of
        treating partial output as a successful complete answer.
        """
        total = 0
        pending = b""
        lines = []
        event_bytes = 0
        done = False
        while chunk := upstream.read1(8192):
            total += len(chunk)
            if total > 16 * 1024 * 1024:
                raise ValueError("upstream size limit")
            pending += chunk
            if len(pending) > 1024 * 1024:
                raise ValueError("upstream event size limit")
            while b"\n" in pending:
                line, pending = pending.split(b"\n", 1)
                line = line.rstrip(b"\r")
                event_bytes += len(line)
                if event_bytes > 1024 * 1024:
                    raise ValueError("upstream event size limit")
                if line:
                    lines.append(line)
                    continue
                data = b"\n".join(line[5:].lstrip(b" ") for line in lines if line.startswith(b"data:"))
                if data:
                    if data == b"[DONE]":
                        done = True
                    else:
                        parsed = json.loads(data)
                        if not isinstance(parsed, dict) or parsed.get("error"):
                            raise ValueError("upstream event error")
                    self.wfile.write(b"\n".join(lines) + b"\n\n")
                    self.wfile.flush()
                lines = []
                event_bytes = 0
                if done:
                    return
        if not done:
            raise ValueError("truncated upstream stream")


def make_server(config=None):
    config = config or Config.from_env()
    return AppServer((config.host, config.port), config)


if __name__ == "__main__":
    try:
        app = make_server()
    except (ValueError, OSError) as exc:
        raise SystemExit("启动失败：" + str(exc))
    print(f"Second Curve: http://{app.config.host}:{app.server_address[1]}", flush=True)
    print("OpenAI API Key: " + ("已配置" if app.config.api_key else "未配置；请设置 OPENAI_API_KEY 后重启"), flush=True)
    try:
        app.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        app.server_close()
