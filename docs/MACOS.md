# macOS 安装与构建

## Release 安装

从 [GitHub Releases](https://github.com/Olivia1201007/second-curve/releases) 下载 macOS `.dmg` 和 `macos-sha256.txt`。本工作流生成通用 macOS DMG，目标架构包括 Apple Silicon（arm64）和 Intel（x86_64）。

1. 使用 `shasum -a 256 -c macos-sha256.txt` 核对下载文件。
2. 打开 DMG，将 SECOND CURVE 拖到 Applications。
3. 首次启动若提示应用未签名，请确认文件来自本项目的 GitHub Release 并且校验值一致。

当前包没有 Apple Developer ID 代码签名或公证，macOS Gatekeeper 可能阻止打开。此包适合项目测试；不要把未签名包作为大规模正式分发版本。正式分发前需要 Apple Developer 账号、Developer ID 证书和公证流程。

## 本地构建

要求 macOS、Xcode Command Line Tools、Rust stable 和 Node.js 22+。

```bash
npm ci
npm run tauri:dev
npm run tauri:build -- --target universal-apple-darwin --bundles dmg
```

DMG 输出在 `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`。GitHub Actions 在推送 `v*` 标签时自动构建 Android、Windows 和 macOS 包，并生成 SHA-256 校验文件。
