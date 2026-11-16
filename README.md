# SECOND CURVE｜第二曲线 AI

**AI Career Transition & Re-employment Copilot** · 面向 35–55 岁失业、待业及职业转型人群的求职助手。

> 过去的经验，值得被重新看见。

[Web 在线体验](https://second-curve-career.wiryfox513.chatgpt.site/) · [GitHub Public 仓库](https://github.com/Olivia1201007/second-curve) · [v1.0.0 Release 下载](https://github.com/Olivia1201007/second-curve/releases/tag/v1.0.0)

SECOND CURVE 帮助用户从真实工作任务中发现可迁移能力，整理求职材料并开始下一步行动。页面不以年龄推断能力，不承诺就业结果，也不编造招聘、工资或用户业绩。

## 社会价值与目标用户

35–55 岁求职者可能需要在收入、家庭、地点与数字技能限制下尽快重新就业。产品用清晰的小步流程梳理既有经验，帮助用户把做过的事说明白、对照真实岗位要求、准备简历和面试。核心体验无需注册，个人资料默认留在当前设备。

## 当前功能（真实实现）

- 极简首页，新用户从空白档案开始；演示内容需要主动加载且会显示“演示数据”。
- 四步职业经历整理、语音输入（取决于系统/浏览器支持）和 PDF/DOCX/TXT/图片导入；文件解析与 OCR 在本机运行。
- 根据用户输入生成带原文依据的技能线索、任务拆解和经验迁移方向。
- 三类职业方向及可修改目标；粘贴真实招聘描述进行关键词对照。
- 简历、自我介绍与求职邮件草稿；面试回答结构练习；行动计划、岗位跟进和 PDF 打印。
- Android 原生壳：本地静态资源打包、应用图标/启动页、系统返回、网络状态提示、系统分享。
- Windows 与 macOS Tauri 桌面包：本地静态资源、独立窗口、系统应用图标。

## 真实边界

- 当前没有真实模型 API、知乎接口、实时招聘检索、工资数据库、账号/云同步或服务器数据库。工作分析使用本地规则。
- “求职匹配”仅将用户提供的经历与招聘文字做关键词对照，不是正式评分或录用概率。
- 薪资不输出市场估算；招聘平台链接由用户自行访问并核实。
- 应用离线可打开本地页面并读取本机已保存资料。实时 AI/招聘服务当前没有接入。
- 网站链接在中国大陆的网络可达性未做覆盖性测试，不能承诺无需 VPN 在所有地区稳定访问。Android/Windows 包内核心资源本地打包，不启动外部网站。

## 产品截图与图标

![SECOND CURVE 品牌图标](docs/assets/second-curve-icon-1024.png)

首页在线预览：[打开体验](https://second-curve-career.wiryfox513.chatgpt.site/)。当前仓库包含品牌图标；可复现的界面截图待加入正式设备截图流程。

## 技术栈与架构

- Web：Next.js 16、React 19、TypeScript、静态导出。
- Android：Capacitor 7，`out/` 被复制到 Android app assets。
- Windows/macOS：Tauri 2，窗口加载安装包内的 `out/` 文件；macOS Release 生成 Intel 与 Apple Silicon 通用 DMG。
- 本地服务：`lib/engine.ts`、`lib/career-service.ts`。
- 数据：浏览器/WebView `localStorage`；没有服务器个人档案存储。
- OCR/文件：本地 Tesseract.js 语言资源、PDF.js、Mammoth。

详细说明：[架构](docs/architecture.md) · [技术审查](docs/TECH_REVIEW.md) · [数据隐私](docs/PRIVACY.md)

## 目录结构

```text
app/                    Next.js 页面、样式、Logo 与元数据
lib/                    职业领域规则、分析服务接口
public/                 OCR、PDF worker 与离线语言资源
android/                Capacitor Android 原生工程
src-tauri/              Tauri 桌面工程与 Windows 打包图标
.github/workflows/      质量检查、Android、桌面 Release 与镜像工作流
tests/                  职业规则单元测试
docs/                   产品计划、技术审查、安装与隐私文档
scripts/                Gitee 镜像同步脚本
```

## 本地 Web 开发

要求 Node.js 22 或更高版本：

```bash
npm ci
npm run dev
```

构建静态网站：`npm run build`，输出到 `out/`。

## 工程检查

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

GitHub Actions 在 `main` 和 PR 运行上述检查；Android APK、Windows 安装包和 macOS 通用 DMG 由标签 `v*` 触发构建并附带 SHA-256 文件。APK 当前是 Debug 评委体验版，不是 Android 商店签名发布包。

## Android

安装 Android Studio、Android SDK Platform 35、JDK 21：

```bash
npm ci
npm run android:sync
cd android
./gradlew assembleDebug
```

APK：`android/app/build/outputs/apk/debug/app-debug.apk`。安装、签名和离线说明见 [Android 指南](docs/app-installation.md)。[v1.0.0 Release](https://github.com/Olivia1201007/second-curve/releases/tag/v1.0.0) 提供 Actions 构建的 Debug APK 与 SHA256 文件。APK 使用 Android Debug 签名，不是商店发布签名。

## Windows

安装 Rust stable、Microsoft C++ Build Tools 与 WebView2 Runtime：

```powershell
npm ci
npm run tauri:dev
npm run tauri:build
```

安装包输出到 `src-tauri/target/release/bundle/`。[v1.0.0 Release](https://github.com/Olivia1201007/second-curve/releases/tag/v1.0.0) 提供 Actions 构建的 EXE、MSI 和 SHA256 文件。Windows 安装包未配置代码签名，系统可能显示 SmartScreen 提示。

## macOS

本地构建需要 macOS、Xcode Command Line Tools、Rust stable 与 Node.js 22 或更高版本：

```bash
npm ci
npm run tauri:dev
npm run tauri:build -- --target universal-apple-darwin --bundles dmg
```

GitHub Release 会生成同时支持 Apple Silicon 与 Intel 的 DMG。构建目前未配置 Apple Developer ID 签名和公证；macOS 可能显示开发者无法验证提示。个人测试时请先确认下载来源并核对 `macos-sha256.txt`。向普通用户分发前应配置 Developer ID 签名和 Apple 公证。

## 环境变量与 API

`.env.example` 提供未来服务端适配器占位配置；**当前应用不读取这些变量，也无需配置 API key**。绝不可将模型密钥加入 `NEXT_PUBLIC_*`、网页静态资源、Android APK 或 Windows 安装包。真实模型需通过受控服务端 API 代理接入。

## 数据来源与合规

- 知乎数据开放平台：[官方入口](https://developer.zhihu.com/)，本项目未取得 API 授权，未抓取或展示知乎内容。
- 招聘与工资：未连接招聘数据 API 或工资数据库；用户访问真实招聘平台后自行核实。
- AI 推理：当前无远程模型调用，页面规则结果会明确标为本地分析。

## 参赛说明

评委指南：[docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md) · 产品计划：[docs/PRODUCT_PLAN.md](docs/PRODUCT_PLAN.md) · 开发说明：[docs/development.md](docs/development.md) · 部署：[docs/deployment.md](docs/deployment.md) · 工程规范：[docs/engineering-standards.md](docs/engineering-standards.md) · GitHub 发布准备：[docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md)

## 开源与贡献

MIT License。欢迎查看 [贡献指南](CONTRIBUTING.md)、[行为准则](CODE_OF_CONDUCT.md) 与 [安全政策](SECURITY.md)。请勿提交真实简历、雇主机密或任何 API/签名凭证。

---

# English

SECOND CURVE helps mid-career job seekers turn real work experience into transferable skills and practical job-search actions. It is available as a static web app and is packaged for Android (Capacitor), Windows, and macOS (Tauri). Current analysis is local and rule-based; no live AI, job feed, salary dataset, or cloud profile storage is connected. No employment outcome is guaranteed.
