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
| Capacitor Android 工程/资源同步 | 通过           | Actions run `43892149864` 的 `npx cap sync android` 成功                                                          |
| Android Debug APK               | Release 已发布 | Actions run `43896828972` 成功；APK 使用标准 Debug 签名，不是商店发布签名                                        |
| Windows MSI/EXE                 | Release 已发布 | Actions run `43896828972` 成功；安装包与 `windows-sha256.txt` 已上传，未配置代码签名                             |
| Sites Web URL                   | 已有           | https://second-curve-career.wiryfox513.chatgpt.site/；APP 4.0 尚未发布到该 URL                                    |
| GitHub 公开仓库                 | 已发布         | https://github.com/Olivia1201007/second-curve；`main` 指向 `069ce52`，CI run `43896426208` 成功                   |
| Gitee 镜像                      | 未创建         | 未授权；已有手动镜像脚本与可选工作流                                                                              |
