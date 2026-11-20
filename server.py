"""Second Curve: same-origin static app and a small server-side OpenAI proxy.

No third-party packages are required. Set OPENAI_API_KEY in this process's
environment, then run ``python server.py``. The key never enters the HTML.
"""
from __future__ import annotations

import base64
import binascii
from collections import deque
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import hashlib
import hmac
import http.client
import json
import mimetypes
import os
import re
import secrets
import socket
import threading
import time
from urllib import error, parse, request

BASE = Path(__file__).resolve().parent
MAX_BODY = 2 * 1024 * 1024
PUBLIC_MAX_BODY = 512 * 1024
VISITOR_COOKIE = "secondcurve_visitor"
VISITOR_COOKIE_MAX_AGE = 24 * 60 * 60
MODEL_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$")
ADMIN_API_SETTINGS_URL = "https://dashboard.render.com/web/srv-dc05gjajnfac73910d7g/env"


@dataclass(frozen=True)
class Config:
    api_key: str = ""
    model: str = "gpt-4.1-mini"
    models: tuple[str, ...] = ("gpt-4.1-mini",)
    base_url: str = "https://api.openai.com/v1"
    host: str = "127.0.0.1"
    port: int = 8787
    app_origin: str = ""
    access_username: str = ""
    access_password: str = ""
    public_visitor_mode: bool = False
    public_dir: Path = BASE / "public"
    timeout: float = 90
    concurrency: int = 4
    visitor_concurrency: int = 1
    visitor_requests_per_minute: int = 4
    global_requests_per_minute: int = 30
    visitor_requests_per_day: int = 12
    global_requests_per_day: int = 100
    visitor_output_tokens_per_day: int = 8192
    global_output_tokens_per_day: int = 65536
    max_input_chars: int = 500000
    max_response_bytes: int = 16 * 1024 * 1024
    max_body_bytes: int = MAX_BODY
    max_output_tokens: int = 4096

    def __post_init__(self):
        if self.public_visitor_mode:
            if not self.access_username or not self.access_password:
                raise ValueError("访客模式必须设置管理 Basic Auth 凭据")
            object.__setattr__(self, "max_input_chars", min(self.max_input_chars, 32000))
            object.__setattr__(self, "max_response_bytes", min(self.max_response_bytes, 512 * 1024))
            object.__setattr__(self, "max_body_bytes", min(self.max_body_bytes, PUBLIC_MAX_BODY))
            object.__setattr__(self, "max_output_tokens", min(self.max_output_tokens, 1024))

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
        origin = (
            os.getenv("APP_ORIGIN", "").strip().rstrip("/")
            or os.getenv("RENDER_EXTERNAL_URL", "").strip().rstrip("/")
        )
        access_username = os.getenv("APP_ACCESS_USERNAME", "").strip()
        access_password = os.getenv("APP_ACCESS_PASSWORD", "")
        public_visitor_mode = os.getenv("PUBLIC_VISITOR_MODE", "").strip().lower() in {"1", "true", "yes", "on"}
        if origin:
            o = parse.urlsplit(origin)
            if o.scheme not in {"http", "https"} or not o.netloc or o.path or o.query or o.fragment or o.username or o.password:
                raise ValueError("APP_ORIGIN 只填写网页来源，如 https://example.com")
        public_host = host not in {"127.0.0.1", "localhost", "::1"}
        if public_host and (not origin or parse.urlsplit(origin).scheme != "https"):
            raise ValueError("非本机监听必须设置 HTTPS APP_ORIGIN")
        if public_host or public_visitor_mode:
            if not access_username or not access_password:
                raise ValueError("公网或访客模式必须设置 APP_ACCESS_USERNAME 和 APP_ACCESS_PASSWORD 以保护管理路径")
        elif bool(access_username) != bool(access_password):
            raise ValueError("APP_ACCESS_USERNAME 和 APP_ACCESS_PASSWORD 必须同时设置")
        return cls(
            api_key=os.getenv("OPENAI_API_KEY", "").strip(), model=model, models=models,
            base_url=base_url, host=host, port=int(os.getenv("PORT", "8787")),
            app_origin=origin, access_username=access_username,
            access_password=access_password, public_visitor_mode=public_visitor_mode,
            public_dir=BASE / "public",
            timeout=max(5, min(float(os.getenv("OPENAI_TIMEOUT", "90")), 300)),
            concurrency=max(1, min(int(os.getenv("OPENAI_CONCURRENCY", "4")), 16)),
            max_output_tokens=max(64, min(int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "4096")), 32768)),
            max_input_chars=max(1000, min(int(os.getenv("OPENAI_MAX_INPUT_CHARS", "500000")), 500000)),
            max_response_bytes=max(64 * 1024, min(int(os.getenv("OPENAI_MAX_RESPONSE_BYTES", str(16 * 1024 * 1024))), 16 * 1024 * 1024)),
            max_body_bytes=MAX_BODY,
        )


class UsageQuota:
    DAY_SECONDS = 24 * 60 * 60
    MINUTE_SECONDS = 60

    def __init__(self, config: Config):
        self.config = config
        self.lock = threading.Lock()
        self.global_events = deque()
        self.visitor_events = {}
        self.active_global = 0
        self.active_visitors = {}

    @staticmethod
    def _prune(events, cutoff):
        while events and events[0][0] <= cutoff:
            events.popleft()

    @staticmethod
    def _retry_after(events, window, now):
        for at, _ in events:
            if at > now - window:
                return max(1, int(at + window - now))
        return 1

    def _retry_after_tokens(self, events, requested_tokens, limit, now):
        needed = sum(tokens for _, tokens in events) + requested_tokens - limit
        freed = 0
        for at, tokens in events:
            freed += tokens
            if freed >= needed:
                return max(1, int(at + self.DAY_SECONDS - now))
        return self.DAY_SECONDS

    def reserve(self, visitor_id, requested_tokens):
        now = time.monotonic()
        with self.lock:
            global_events = self.global_events
            self._prune(global_events, now - self.DAY_SECONDS)
            for existing_id, events in list(self.visitor_events.items()):
                self._prune(events, now - self.DAY_SECONDS)
                if not events and not self.active_visitors.get(existing_id):
                    del self.visitor_events[existing_id]
            active_visitor = self.active_visitors.get(visitor_id, 0)

            if self.active_global >= self.config.concurrency:
                return 0, "concurrency_limit", 1
            minute_cutoff = now - self.MINUTE_SECONDS
            global_recent = sum(at > minute_cutoff for at, _ in global_events)
            if global_recent >= self.config.global_requests_per_minute:
                return 0, "global_rate_limit", self._retry_after(global_events, self.MINUTE_SECONDS, now)
            if len(global_events) >= self.config.global_requests_per_day:
                return 0, "global_daily_limit", self._retry_after(global_events, self.DAY_SECONDS, now)

            visitor_events = self.visitor_events.setdefault(visitor_id, deque())
            if active_visitor >= self.config.visitor_concurrency:
                return 0, "visitor_concurrency_limit", 1
            visitor_recent = sum(at > minute_cutoff for at, _ in visitor_events)
            if visitor_recent >= self.config.visitor_requests_per_minute:
                return 0, "visitor_rate_limit", self._retry_after(visitor_events, self.MINUTE_SECONDS, now)
            if len(visitor_events) >= self.config.visitor_requests_per_day:
                return 0, "visitor_daily_limit", self._retry_after(visitor_events, self.DAY_SECONDS, now)

            visitor_tokens = sum(tokens for _, tokens in visitor_events)
            global_tokens = sum(tokens for _, tokens in global_events)
            if visitor_tokens + requested_tokens > self.config.visitor_output_tokens_per_day:
                return 0, "visitor_token_quota", self._retry_after_tokens(
                    visitor_events, requested_tokens, self.config.visitor_output_tokens_per_day, now,
                )
            if global_tokens + requested_tokens > self.config.global_output_tokens_per_day:
                return 0, "global_token_quota", self._retry_after_tokens(
                    global_events, requested_tokens, self.config.global_output_tokens_per_day, now,
                )

            visitor_events.append((now, requested_tokens))
            global_events.append((now, requested_tokens))
            self.active_global += 1
            self.active_visitors[visitor_id] = active_visitor + 1
            return requested_tokens, None, 0

    def release(self, visitor_id):
        with self.lock:
            self.active_global = max(0, self.active_global - 1)
            active = self.active_visitors.get(visitor_id, 0)
            if active <= 1:
                self.active_visitors.pop(visitor_id, None)
            else:
                self.active_visitors[visitor_id] = active - 1


class ResponseTooLarge(Exception):
    pass


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
        self.visitor_secret = secrets.token_bytes(32)
        self.usage_quota = UsageQuota(config)
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

    def json_reply(self, status, data, headers=()):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        for name, value in headers:
            self.send_header(name, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def fail(self, status, message, code="request_error", headers=()):
        self.json_reply(status, {"error": {"message": message, "type": "proxy_error", "code": code}}, headers)

    def is_public_request(self, path):
        config = self.server.config
        if not config.public_visitor_mode:
            return False
        if path == "/healthz":
            return True
        if path == "/admin" or path.startswith("/admin/") or path == "/api/admin" or path.startswith("/api/admin/"):
            return False
        if self.command in {"GET", "HEAD"}:
            return path in {"/api/models", "/api/config"} or not path.startswith("/api/")
        return self.command == "POST" and path == "/api/chat/completions"

    def visitor_id_from_cookie(self):
        value = ""
        for part in self.headers.get("Cookie", "").split(";"):
            name, separator, item = part.strip().partition("=")
            if separator and name == VISITOR_COOKIE:
                value = item
                break
        visitor_id, separator, signature = value.partition(".")
        if not separator or not re.fullmatch(r"[A-Za-z0-9_-]{32}", visitor_id):
            return None
        expected = hmac.new(self.server.visitor_secret, visitor_id.encode("ascii"), hashlib.sha256).hexdigest()
        return visitor_id if hmac.compare_digest(signature, expected) else None

    def visitor_csrf_token(self, visitor_id):
        return hmac.new(
            self.server.visitor_secret,
            b"csrf:" + visitor_id.encode("ascii"),
            hashlib.sha256,
        ).hexdigest()

    def new_visitor(self):
        visitor_id = secrets.token_urlsafe(24)
        signature = hmac.new(self.server.visitor_secret, visitor_id.encode("ascii"), hashlib.sha256).hexdigest()
        cookie = f"{VISITOR_COOKIE}={visitor_id}.{signature}; Path=/; Max-Age={VISITOR_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax"
        if self.server.config.app_origin.startswith("https://"):
            cookie += "; Secure"
        return visitor_id, cookie

    def authorize_or_public(self, path):
        return self.is_public_request(path) or self.authorized()

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
        path = parse.urlsplit(self.path).path
        document_navigation = (
            self.command == "GET"
            and path in {"/", "/index.html"}
            and self.headers.get("Sec-Fetch-Mode") == "navigate"
            and self.headers.get("Sec-Fetch-Dest") == "document"
        )
        if document_navigation:
            return True
        origin = self.headers.get("Origin")
        allowed_origin = self.server.config.app_origin
        if origin and (origin != allowed_origin if allowed_origin else parse.urlsplit(origin).netloc.lower() != host or parse.urlsplit(origin).scheme != "http"):
            self.fail(403, "仅允许网页同源请求。", "cross_origin")
            return False
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            self.fail(403, "仅允许网页同源请求。", "cross_origin")
            return False
        return True

    def authorized(self):
        config = self.server.config
        if not config.access_username and not config.access_password:
            return True
        try:
            scheme, token = self.headers.get("Authorization", "").split(" ", 1)
            supplied = base64.b64decode(token, validate=True).decode("utf-8")
        except (ValueError, UnicodeDecodeError, binascii.Error):
            supplied = ""
            scheme = ""
        expected = f"{config.access_username}:{config.access_password}"
        if scheme.lower() == "basic" and secrets.compare_digest(supplied, expected):
            return True
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="Second Curve", charset="UTF-8"')
        self.send_header("Content-Length", "0")
        self.end_headers()
        return False

    def do_OPTIONS(self):
        self.fail(403, "不接受跨站调用。", "cross_origin")

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = parse.urlsplit(self.path).path
        if path == "/healthz":
            self.json_reply(200, {"status": "ok"})
            return
        if not self.valid_source():
            return
        if not self.authorize_or_public(path):
            return
        if path == "/admin":
            body = (
                "<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\">"
                "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
                "<title>管理员设置</title><body><main><h1>管理员设置</h1>"
                f"<a href=\"{ADMIN_API_SETTINGS_URL}\">打开 Render API 设置</a>"
                "</main></body></html>"
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("X-Robots-Tag", "noindex, nofollow")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        if path in {"/api/models", "/api/config"}:
            config = self.server.config
            response_headers = ()
            csrf_token = self.server.csrf_token
            if config.public_visitor_mode:
                visitor_id = self.visitor_id_from_cookie()
                cookie = None
                if visitor_id is None:
                    visitor_id, cookie = self.new_visitor()
                csrf_token = self.visitor_csrf_token(visitor_id)
                if cookie:
                    response_headers = (("Set-Cookie", cookie),)
            self.json_reply(200, {
                "object": "list", "data": [{"id": model, "object": "model", "owned_by": "openai", "name": model} for model in config.models],
                "configured": bool(config.api_key), "default_model": config.model,
                "csrf_token": csrf_token,
            }, response_headers)
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
        path = parse.urlsplit(self.path).path
        if not self.authorize_or_public(path):
            return
        if path != "/api/chat/completions":
            self.fail(404, "接口不存在。", "not_found")
            return
        visitor_id = None
        csrf_token = self.server.csrf_token
        if self.server.config.public_visitor_mode:
            visitor_id = self.visitor_id_from_cookie()
            if visitor_id is None:
                self.fail(403, "访客连接已过期，请重新加载页面。", "invalid_session")
                return
            csrf_token = self.visitor_csrf_token(visitor_id)
        token = self.headers.get("X-Second-Curve-Token", "")
        if not secrets.compare_digest(token, csrf_token):
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
        if length < 1 or length > self.server.config.max_body_bytes:
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
        if self.server.config.public_visitor_mode:
            allowed_tokens, quota_error, retry_after = self.server.usage_quota.reserve(
                visitor_id, payload["max_completion_tokens"],
            )
            if quota_error:
                messages = {
                    "concurrency_limit": "服务当前繁忙，请稍后重试。",
                    "visitor_concurrency_limit": "该访客已有请求进行中，请等待完成后重试。",
                    "visitor_rate_limit": "请求过于频繁，请稍后重试。",
                    "global_rate_limit": "服务请求较多，请稍后重试。",
                    "visitor_daily_limit": "该访客今日的 AI 使用次数已达上限。",
                    "global_daily_limit": "今日 AI 服务额度已用完，请稍后再试。",
                    "visitor_token_quota": "该访客今日的 AI 输出额度已用完。",
                    "global_token_quota": "今日 AI 输出额度已用完，请稍后再试。",
                }
                self.fail(
                    429, messages[quota_error], quota_error,
                    (("Retry-After", str(retry_after)),),
                )
                return
            payload["max_completion_tokens"] = allowed_tokens
            try:
                self.forward(payload)
            finally:
                self.server.usage_quota.release(visitor_id)
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
        if chars > config.max_input_chars:
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
                    raw = upstream.read(config.max_response_bytes + 1)
                    if len(raw) > config.max_response_bytes:
                        raise ResponseTooLarge()
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
        except ResponseTooLarge:
            if sent_headers:
                try:
                    frame = {"error": {"message": "响应超过访客模式的长度上限。", "type": "proxy_error", "code": "response_too_large"}}
                    self.wfile.write(("data: " + json.dumps(frame, ensure_ascii=False) + "\n\n").encode("utf-8"))
                    self.wfile.flush()
                except OSError:
                    pass
            else:
                self.fail(502, "上游响应超过访客模式的长度上限。", "response_too_large")
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
        event_limit = min(
            64 * 1024 if self.server.config.public_visitor_mode else 1024 * 1024,
            self.server.config.max_response_bytes,
        )
        while chunk := upstream.read1(8192):
            total += len(chunk)
            if total > self.server.config.max_response_bytes:
                raise ResponseTooLarge()
            pending += chunk
            if len(pending) > event_limit:
                raise ResponseTooLarge()
            while b"\n" in pending:
                line, pending = pending.split(b"\n", 1)
                line = line.rstrip(b"\r")
                event_bytes += len(line)
                if event_bytes > event_limit:
                    raise ResponseTooLarge()
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
