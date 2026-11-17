# 发布与打包（4.1.0）

## 安装版

Windows 和 Android 均将 `out/` 页面与原生模型模块编进应用。无需部署项目后端、配置公网项目 API 或启动 Python。用户安装后在个人中心配置供应商信息和自己的密钥，启用后由原生模块联网访问云模型。不得在构建环境或安装包中植入团队共享密钥。

Windows：`npm ci` 后运行 `npm run tauri:build`，产物在 `src-tauri/target/release/bundle/`。需要 Rust、MSVC、Windows SDK；运行需要 WebView2。

Android：`npm ci` 后运行 `npm run android:sync`，再在 `android/` 运行 `./gradlew assembleDebug`。需要 JDK 21 和 Android SDK 35；产物在 `android/app/build/outputs/apk/debug/`。Debug APK 供测试，正式发布须使用组织签名并妥善保管 keystore。

版本号为 4.1.0；源码下载标签沿用 v1.0.0，目录名不代表本次应用版本。安装包构建、设备验收、真实模型验收是三项不同检查，应分别记录。

## Web

静态网页继续使用本机规则；原生模型设置不能在普通浏览器中启用。若未来希望网页也使用模型，需要重新设计服务端鉴权和密钥保护，不能将安装版密钥逻辑复制到浏览器存储。当前公开 Sites 链接未因本次本地打包而更新。

## GitHub 与后续发布

保留原有质量检查及标签构建工作流。提交前排除 `node_modules`、`out`、`.next`、Rust `target`、Android 构建缓存、密钥与签名文件。发布时附上实际构建产物和 SHA-256，说明是否签名与是否设备测试。此文档本身不证明工作流已运行或安装包已发布。
