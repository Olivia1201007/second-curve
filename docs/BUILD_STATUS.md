# APP 4.0 构建状态

更新时间：2026-11-16（Asia/Shanghai）

| 项目                            | 状态           | 证据/限制                                                                                                         |
| ------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Web 静态生产构建                | 通过           | `npm run build`，Next.js 16.4.6                                                                                   |
| ESLint                          | 通过           | `npm run lint`                                                                                                    |
| TypeScript                      | 通过           | `npm run typecheck`                                                                                               |
| 单元测试                        | 通过           | `npm test`，5 项业务规则测试                                                                                      |
| Prettier                        | 通过           | `npm run format:check`                                                                                            |
| 生产依赖审计                    | 通过           | `npm audit --omit=dev --audit-level=high`：0 个高危及以上；开发工具全量审计仍报告仅开发依赖的 moderate advisories |
| Capacitor Android 工程/资源同步 | 通过           | `npx cap add android`、图标/启动资源生成、`npx cap sync android`                                                  |
| Android APK                     | Actions 待构建 | 本机没有 Android SDK；由 GitHub-hosted Actions 构建，成功后再提供 APK 与 SHA256                                   |
| Windows MSI/EXE                 | Actions 待构建 | 本机没有 Windows/Rust 工具链；由 Windows GitHub-hosted Actions 构建，成功后再提供安装包与 SHA256                  |
| Sites Web URL                   | 已有           | https://second-curve-career.wiryfox513.chatgpt.site/；APP 4.0 尚未发布到该 URL                                    |
| GitHub 公开仓库                 | 已创建         | https://github.com/Olivia1201007/second-curve；首次代码推送后验证 Actions                                         |
| Gitee 镜像                      | 未创建         | 未授权；已有手动镜像脚本与可选工作流                                                                              |
