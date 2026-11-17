# SECOND CURVE｜第二曲线 AI 4.1.0

面向 35–55 岁失业、待业与职业转型人群的求职助手。帮助用户从真实工作任务中发现可迁移能力、对照岗位要求并整理求职材料。

Windows 与 Android 安装版已加入**软件原生模块直接调用云模型**的实现。软件包含界面、职业业务逻辑和模型适配器，不需要另开 Python 后端或部署项目服务器；模型在供应商云端运行，使用云模型时仍需联网。

## 使用云模型

1. 安装新版 Windows 或 Android 应用，打开「个人中心 → 云模型设置」。
2. 选择看山、DeepSeek 或 Kimi，填写该账号有权限使用的 Base URL、模型 ID 和 API Key。
3. 保存配置，再勾选「我已了解文字发送范围，启用云模型整理」。
4. 回到经历分析、招聘对照或经历表达页面，主动点击整理。

默认使用本机规则。保存配置不会自动启用云模型；可随时关闭或清除配置。关闭后使用本机规则，云请求失败会显示错误，不会把本机规则结果冒充模型成功结果。网页预览继续使用本机规则，原生模型设置只在 Windows / Android 安装版中可用。

安装包不含团队共享密钥。每台设备自行配置自己的密钥：Windows 使用系统凭据管理器，Android 使用 AndroidKeyStore 加密保存。不要把真实密钥写入源码、`.env`、`NEXT_PUBLIC_*`、静态资源或安装包。

**看山尚未领取额度和凭证，未做真实调用验收。** 当前实现支持 Bearer API Key + Chat Completions 兼容协议；领取后须核对工作台的真实接口地址、模型 ID、请求字段与返回格式。若协议不同，需要调整原生适配器。看山模型调用与知乎内容搜索是两项独立能力。

## 功能范围

| 功能                               | 默认本机模式               | 启用云模型后                   |
| ---------------------------------- | -------------------------- | ------------------------------ |
| 经历分析 `analyze`                 | 本机规则拆解任务与技能线索 | 云模型按结构整理，保留原文依据 |
| 招聘对照 `matchJob`                | 用户提供文本的关键词对照   | 云模型整理要求、依据与待补充项 |
| 经历表达 `polishExperience`        | 本机模板                   | 云模型整理用户已提供的事实     |
| 方向、行动计划、面试结构及其他草稿 | 本机规则与模板             | 仍由本机规则与模板生成         |

支持 PDF/DOCX/TXT/图片导入，文件解析和 OCR 在本机执行；职业档案、草稿、任务和岗位跟进保存在本机 `localStorage`。云模型仅在主动点击上述三个功能时接收该次所需文字。基础脱敏不是完整匿名化，发送前请去除不必要的个人信息与单位机密。

没有自动招聘检索、知乎帖子检索、工资数据库、账号或跨设备同步。岗位由用户查阅真实招聘信息后粘贴；模型分析不等于正式评分或录用概率，不承诺就业结果。旧网站 [Web 体验](https://second-curve-career.wiryfox513.chatgpt.site/) 本次没有重新发布。

## 架构与目录

```text
Next.js 静态页面 out/
  → CareerProvider（本机规则 / 云模型）
  → lib/native-model.ts
      ├─ Windows Tauri commands → Rust HTTPS → 云模型
      └─ Android CareerModel plugin → Java HTTPS → 云模型

lib/model-career-provider.ts   提示词、基础脱敏、返回结构及依据校验
lib/engine.ts                 本机职业规则
src-tauri/src/model.rs        Windows 配置、密钥与 HTTPS 请求
android/app/src/main/java/    Android 配置、密钥与 HTTPS 请求
tests/                       业务与原生桥前端契约测试
```

详见 [架构](docs/architecture.md)、[接口](docs/API.md)、[隐私](docs/PRIVACY.md)、[接入状态](docs/INTEGRATIONS.md) 和 [4.1.0 变更](docs/CHANGELOG-4.1.0.md)。

## 开发与构建

要求 Node.js 22+。前端检查与静态构建：

```bash
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Windows 需要 Rust stable、Microsoft C++ Build Tools、Windows SDK 和 WebView2 Runtime：

```powershell
npm run tauri:dev
npm run tauri:build
```

安装包输出到 `src-tauri/target/release/bundle/`。

Android 需要 JDK 21、Android SDK Platform 35 与 Build Tools：

```bash
npm run android:sync
cd android
./gradlew assembleDebug
```

APK 输出到 `android/app/build/outputs/apk/debug/app-debug.apk`，属于 Debug 测试包。正式发行应配置团队签名。详见 [开发](docs/development.md)、[发布](docs/deployment.md)、[Android 安装](docs/app-installation.md) 和 [Windows 安装](docs/WINDOWS.md)。构建通过不代表已完成真机或看山真实服务验收，实际验证以交付记录为准。

## 数据来源与贡献

知乎数据开放平台：[官方入口](https://developer.zhihu.com/)。当前没有知乎内容接口凭证与检索实现；招聘/工资数据也未接入。新增检索应在取得授权后记录原始来源、时间和有效性。

MIT License。请勿提交真实简历、雇主机密、模型密钥、签名文件或密码。
