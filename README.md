# 第二曲线 · OpenAI 接入版

在最新明亮弹窗与拖拽修复版上替换 AI 接口。首页、1241 条岗位、筛选、收藏、六点拖拽、求职进度、个人资料、简历导入、导出、亚克力按钮、滚动渐入及切屏动效沿用原版。模型菜单显示配置的 OpenAI 模型，页脚提供方文字改为 OpenAI。

## 架构

- `public/index.html` 是完整单页应用；CSS、业务脚本、图标和 1241 条公开岗位记录均内嵌其中。
- `openai-adapter.js` 将原有模型/对话接口连接到同源 API；岗位数据与收藏、资料、简历版本和求职进度均在浏览器本地处理。
- `server.py` 使用 Python 标准库提供静态页面、模型列表和 Chat Completions 代理。OpenAI Key 只从服务端环境变量读取。
- 岗位记录注明来源链接；详情及薪资需以中国公共招聘网原始页面为准。

## Windows 启动

1. 解压整个压缩包，安装 Python 3.10 或以上版本（无需安装任何第三方依赖）。
2. 双击 `start.cmd`。
3. 在终端输入自己的 OpenAI API Key，内容会隐藏且不会保存到文件。直接回车可以只预览网页。
4. 浏览器自动打开网页（默认 `http://127.0.0.1:8787/`；端口占用时自动另选空闲端口）。保持终端窗口打开。

API Key 可在 <https://platform.openai.com/api-keys> 创建。API 需要账户可用额度；本项目没有内置 Key，也不会读取其他项目的凭据。模型默认 `gpt-4.1-mini`，以你的项目可访问模型为准。

## 手动启动 / 更换模型

在 PowerShell 中设置 `OPENAI_API_KEY` 与 `OPENAI_MODEL` 环境变量，再执行 `python -B server.py`；或直接运行 `python -B launcher.py`，由启动程序隐藏输入 Key。可设置 `OPENAI_MODELS` 为逗号分隔的额外模型 ID，它们会出现在原有模型菜单中。

`.env.example` 仅列出配置格式，服务不会自动加载该文件。默认上游为 `https://api.openai.com/v1`。`OPENAI_BASE_URL` 仅供服务端按需调整，不在网页上公开。

## 部署与使用说明

这是“网页 + 轻量服务端”的完整接入版。`public/index.html` 需要由 `server.py` 提供，不能只双击 HTML 或只把 HTML 上传到静态资料库来获得 AI 功能。服务默认只监听本机；公开部署时，平台需支持常驻 Python 进程、HTTPS 和同源反向代理，并在代理前启用登录或其他访问控制。应用本身不提供用户登录；不要在没有访问控制的情况下把带有服务端 Key 的代理公开给所有人。

公开托管必须使用 HTTPS `APP_ORIGIN`、`APP_ACCESS_USERNAME` 和 `APP_ACCESS_PASSWORD`。Render 会提供 `RENDER_EXTERNAL_URL`，服务可用它作为默认来源；绑定自定义域名时，应显式设置匹配的 `APP_ORIGIN`。服务启动时会拒绝缺少 HTTPS 来源或 Basic Auth 凭据的公网配置；`/healthz` 仅返回不含敏感信息的状态。Render Blueprint 设置 `HOST=0.0.0.0`，Render 提供 `PORT`。托管平台还应设置 `OPENAI_API_KEY`，并可按需配置 `OPENAI_MODEL`、`OPENAI_MODELS`。这些变量不会从 `.env.example` 自动加载。

仓库提供 `render.yaml` 作为 Render 免费 Web Service Blueprint：在 Render Dashboard 通过 **New → Blueprint** 连接此仓库并选择 `main`，审核后创建服务。Blueprint 会要求为 `APP_ACCESS_USERNAME`、`APP_ACCESS_PASSWORD` 和 `OPENAI_API_KEY` 输入值；凭据只应在 Render 的服务环境设置中填写，绝不能提交到 Git 或发送到聊天。若使用 Render 默认域名，服务会读取 Render 自动提供的 HTTPS 地址；绑定自定义域名后，需在服务环境中设置匹配的 `APP_ORIGIN`。Render 免费实例会在空闲后休眠，首次唤醒可能延迟；它使用临时文件系统，因此不可把服务本机文件作为持久数据存储。Blueprint 的自动部署仅在 `main` 分支 CI 检查通过后触发。

跨站的顶层页面导航只在浏览器标记为 `navigate`/`document` 时放行，以便从外部链接打开首页；API、子资源及 POST 仍受来源校验和 CSRF token 保护。Basic Auth 保护除健康检查外的所有路由。这里的 Blueprint 是部署配置，不代表已创建托管资源或已完成公网验收。

网页中不包含 OpenAI Key。浏览器只访问同源 `/api/models`、`/api/chat/completions`，服务端调用 OpenAI Chat Completions API。对话和岗位匹配支持流式输出及停止生成。未配置 Key、额度不足、模型不可用、网络中断会显示错误，不会伪造回复。

资料、简历版本、收藏及进度仍保存在当前浏览器；如果从 WorkBuddy 改用本地地址，浏览器会使用另一个站点存储空间。已有收藏可在原版“我的求职”导出备份后，在新版同处导入；其他资料请保留原版导出备份。

只有主动提交到 AI 的消息及其中附带的简历或岗位内容会发送到接入服务并转交 OpenAI。服务端不记录请求正文和密钥。

## 验证

`python -B -m unittest -v test_server.py` 使用本机模拟上游验证代理、参数校验、流式事件、密钥缺失与访问边界。

`node --test test_adapter.mjs` 验证浏览器兼容桥的流式解析、中文分块、错误和取消。测试不使用真实 OpenAI Key，不消耗额度。

自动化测试使用本机模拟上游和浏览器 `fetch`，不需要真实 Key，也不会连接或消耗 OpenAI 额度。浏览器可检查页面、岗位筛选/详情/收藏、资料与求职进度、简历导入和模型菜单；未配置 Key 时聊天与岗位匹配会显示明确错误。流式输出、取消和中断由适配器模拟测试覆盖。真实 OpenAI 连通性及任何公开部署均须另行配置和验收。

## 回滚

迁移前的 `main` 保存在 `backup/main-pre-openai-migration-20261120`。发布后如需恢复旧项目，优先对迁移提交执行 `git revert <迁移提交 SHA>` 并正常推送，让托管平台重新部署回滚提交；不要 force-push。部署服务尚未配置前，本仓库不会自动发布公网网站。

官方参考：<https://developers.openai.com/api/docs/quickstart>、<https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create>。
