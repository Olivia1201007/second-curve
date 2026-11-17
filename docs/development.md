# 本地开发

4.1.0 的 Windows / Android 原生模块直接连接云模型，不需要额外启动 Python 或项目服务器。普通浏览器预览保持本机规则。配置与接口见 [API](API.md) 和 [架构](architecture.md)。禁止将模型密钥写进构建环境变量或源码；使用安装版的个人中心设置。

## Web

需要 Node.js 22 或更高版本。

```bash
npm ci
npm run dev
```

生产静态资源：`npm run build`，输出 `out/`。

## Android

安装 Android Studio、Android SDK Platform 35、Build Tools、JDK 21 后：

```bash
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

APK 输出：`android/app/build/outputs/apk/debug/app-debug.apk`。Debug APK 仅供测试和评委体验，不是商店发布签名包。

## Windows

需要 Rust stable、Microsoft C++ Build Tools 与 WebView2 Runtime：

```powershell
npm ci
npm run tauri:dev
npm run tauri:build
```

安装包位于 `src-tauri/target/release/bundle/`。Windows 构建工作流也可以在 GitHub Actions 云端运行。
