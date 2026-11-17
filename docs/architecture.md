# 4.1.0 架构说明

```text
Next.js / React / TypeScript → next build → out/ 静态资源
  ├─ Web 预览：本机规则
  ├─ Android：Capacitor WebView + CareerModel Java 插件
  └─ Windows：Tauri 窗口 + Rust 模型命令

页面 → CareerProvider → 本机规则
                   └→ 云模型业务适配器 → 原生桥 → HTTPS 云模型

职业档案/草稿/任务：本机 localStorage
文件/OCR：本机解析
模型密钥：Windows Credential Manager / AndroidKeyStore 加密
```

## 原生调用

`lib/career-service.ts` 保留 `CareerProvider` 契约，按原生设置选择本机或云模型实现。`lib/model-career-provider.ts` 实现经历分析、岗位对照、经历润色的提示词、基础脱敏及结果校验。`lib/native-model.ts` 在 Windows 使用 Tauri invoke，在 Android 使用 `CareerModel` Capacitor 插件。

原生层读取本机密钥、构造 Chat Completions 请求并通过 HTTPS 访问所选供应商。WebView 不直接向模型发 fetch，密钥不返回前端，不需要放开 Windows WebView 的远程模型连接策略。应用没有项目 HTTP 后端、Python 子进程、模型权重或服务器数据库。供应商云服务需要联网。

原生层限制并发、响应大小与请求时间，禁用重定向。错误显示给用户，云模型出错不静默替换成本机成功结果。返回结构、原文证据和数字声明的校验可减少错误，不能保证模型输出完全正确。

## 配置与数据流

保存配置后必须主动启用。更换供应商或 Base URL 要重新输入密钥；原生加载接口仅返回供应商、地址、模型和是否配置/启用，不返回密钥。Android 禁用应用备份，避免配置随备份迁移。

每次主动操作只发送对应功能所需的文字；没有自动上传整个文件或历史。输入先做电话、邮箱、身份证号的基础脱敏，仍需用户主动清除姓名、单位机密等信息。方向、行动计划、面试结构及其他模板草稿继续在本机生成。

## 未接入能力

看山尚无凭证，当前适配假设为 Bearer API Key + Chat Completions 兼容协议，需按工作台调用示例验证。知乎招聘帖/再就业帖检索是独立集成，不由本模型桥提供。没有账号、云同步、实时职位或工资数据库。
