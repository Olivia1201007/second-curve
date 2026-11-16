# 架构说明

```text
Next.js / React / TypeScript
        │ `next build` (static export)
        ├── Web: OpenAI Sites → out/
        ├── Android: Capacitor → Android WebView + packaged out/ assets
        └── Windows: Tauri 2 → native window + packaged out/ assets

Shared browser-side services: lib/career-service.ts, lib/engine.ts
Persistence: localStorage; OCR/PDF/DOCX parsing runs locally
Remote AI/job/salary/database services: not configured
```

## Native bridge

Capacitor App handles Android hardware back navigation. Share uses the Android share sheet on native and Web Share/clipboard fallback in browsers. The UI continues to use a local file input so Android presents its system document picker. The Tauri application uses the same local static assets; no remote website URL is embedded as its startup target.

## Future server provider boundary

`CareerProvider` is the replaceable service interface. A future backend should expose validated JSON endpoints and server-side adapters for a China-accessible model provider. Keep API keys in deployment secret storage only, apply request limits, timeouts, retries, minimal logging, and explicit resume-sharing consent. Do not add credentials to `NEXT_PUBLIC_*` or mobile bundles.
