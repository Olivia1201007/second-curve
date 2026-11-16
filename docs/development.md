# 本地开发

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
