# SECOND CURVE 技术审查（APP 4.0 起点）

## 现有实现

| 项       | 现状                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| 前端     | Next.js 16.4.6、React 19、TypeScript；`output: export`，静态输出到 `out/`                                  |
| 后端/API | 未发现 API routes、server actions 或后端进程                                                               |
| 数据库   | 未发现数据库；档案、草稿、任务和岗位记录写入浏览器 `localStorage`                                          |
| AI       | `lib/career-service.ts` 使用本地规则；没有远程模型调用                                                     |
| 文件     | PDF、DOCX、TXT、图片读取和 Tesseract OCR 资源随前端静态资源打包；浏览器本地处理                            |
| 发布     | OpenAI Sites 静态托管，项目配置指向 `out/`；线上链接继续保留                                               |
| Git      | GitHub Public 仓库已建立；Gitee 未授权                                                                     |
| 外部依赖 | 页面提供招聘平台与知乎开放平台的外部链接；未发现 Google Fonts、Firebase、OpenAI 默认 API 或 CDN 运行时调用 |
| 构建环境 | Node 24、Java 21、Linux；初始环境没有 Android SDK、Gradle、Rust/Cargo                                      |

## 影响与判断

Web 已静态导出，适合让 Capacitor 直接把 `out/` 文件打进 Android 应用，启动和核心本地功能不依赖先访问公网。Windows 使用 Tauri 加载同一份本地导出资源，减少重复实现。用户本机档案仍只在相应浏览器/WebView 的本地存储中；目前不具备账户或设备间同步。

项目不接实时招聘、工资、知乎内容或真实大模型，因此离线可用仅指加载应用、查看/编辑本地已存内容及本地规则工具；实时 AI 与实时职位检索当前不存在。

## 合规与大陆可用性

静态 Web 站点的公网域名不是中国大陆备案域名；不能宣称全国稳定免 VPN。Android/Windows 包内前端资源采用本地打包；用户选择外部招聘网站时，其可达性由平台和网络环境决定。国内模型如通义千问、DeepSeek、智谱需要服务端代理、有效凭证、数据告知及供应商条款审查后方可接入，本版本不发出简历内容到第三方模型。
