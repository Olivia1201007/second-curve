# APP 4.1.0 验证记录说明

本次在 v1.0.0 标签源码上增加原生云模型桥，应用版本更新为 4.1.0、Android versionCode 更新为 5。原 4.0 构建记录不能证明新版通过验收。

本次已完成以下构建与静态验证：

| 检查                                          | 结果                                                  |
| --------------------------------------------- | ----------------------------------------------------- |
| Vitest 业务与桥接测试                         | 3 个测试文件、16 项测试通过                           |
| ESLint、TypeScript、Prettier                  | 通过                                                  |
| Next.js 生产静态导出                          | 通过                                                  |
| Windows Rust `cargo check` 与 release 编译    | 通过                                                  |
| Windows NSIS 安装包                           | 已生成 4.1.0 x64 EXE 安装包                           |
| Android Java 编译、资源同步与 `assembleDebug` | 通过                                                  |
| Android APK 元数据                            | 4.1.0，versionCode 5，最低 Android API 23             |
| APK 签名验证                                  | `apksigner verify` 通过，v1/v2 签名有效；使用测试签名 |

Rust 原生模块 2 项单元测试通过，覆盖接口地址与模型响应校验。MSI 不作为本次交付产物。

尚未完成安装后的界面操作、Android 真机检查、设备重启后的配置读写或真实模型端到端验收。Windows 界面检查因 Computer Use 应用访问授权超时未完成，不能把进程启动或编译成功视为界面验收通过。

看山凭证尚未取得，接口地址、模型 ID、鉴权和真实返回协议仍需按工作台调用示例确认。当前公开网站没有随本地修改重新发布。本次修改未推送到 GitHub 或创建新版 Release。
