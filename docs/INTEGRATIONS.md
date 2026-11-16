# 外部服务接入与安全边界

## 当前状态

- 知乎数据开放平台：未授权、未接入。官方入口：[developer.zhihu.com](https://developer.zhihu.com/)。入口网页说明平台提供 API、MCP、Skills、搜索与知识库等产品能力；具体产品权限、接口字段、调用价格和速率以账号内最新文档/合同为准。本项目未抓取知乎内容，也未验证任何接口调用。
- 招聘平台：没有官方岗位数据 API 凭证或授权。页面只链接到招聘平台官网，岗位信息由用户自行查找和粘贴。
- AI 模型：没有服务端运行环境或模型密钥；本地规则模式明确标识。
- 持久化：当前只用浏览器 localStorage。

## 建议服务端接口契约

未来由服务端实现 `POST /api/research/search`、`POST /api/jobs/search`、`POST /api/jobs/match`、`POST /api/career/analyze` 等接口。供应商实现采用 provider adapter，前端仅调用本站接口。服务端必须校验 JSON schema、输入大小、用户授权范围和调用频率；密钥仅在 Worker/服务器 secret 中配置。记录请求时间、来源 URL、数据类型和缓存到期时间，按授权保留最少数据；对错误给出可理解的状态，不把密钥或敏感请求体写日志。

推荐数据源记录字段：`source_type`, `source_name`, `source_url`, `published_at`, `retrieved_at`, `expires_at`, `verification_status`, `license_basis`, `content_hash`。对招聘职位做来源+岗位 URL+公司+职位去重；撤下、过期或无法核实的职位及时标注。

## 未来环境变量（尚未由当前应用读取）

```dotenv
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=
ZHIHU_CLIENT_ID=
ZHIHU_CLIENT_SECRET=
JOB_PROVIDER_API_KEY=
DATABASE_URL=
```

**以上是未来服务端部署的配置清单，不代表当前可以直接填入后生效。** 禁止使用 `NEXT_PUBLIC_` 前缀保存秘密。知乎凭证和招聘 API 应先取得平台授权并遵守对应的展示、缓存、引用和删除要求。
