# API 与原生服务接口（4.1.0）

应用是静态页面加原生模块，没有对外监听的 HTTP API，也不需要另启 Python。页面通过 `CareerProvider` 使用相同的三个业务方法：

| 方法               | 输入                                       | 返回                                   |
| ------------------ | ------------------------------------------ | -------------------------------------- |
| `analyze`          | 岗位、年限、任务、优势、待提升项、求职原因 | `{tasks, skills}`                      |
| `matchJob`         | 经历文字、真实岗位文字                     | `{requirements, evidence, gaps, note}` |
| `polishExperience` | 用户提供的经历文字                         | 字符串数组                             |

本机规则实现和云模型实现采用相同契约。云模型结果须通过结构与依据校验；请求或校验失败抛出可显示的错误，不默默生成本机结果。

## 原生桥

`lib/native-model.ts` 提供 `loadModelSettings`、`saveModelSettings`、`setCloudEnabled`、`clearModelSettings`、`requestModel`。

| 前端操作  | Windows Tauri command      | Android `CareerModel` method |
| --------- | -------------------------- | ---------------------------- |
| 读取配置  | `career_model_load`        | `load`                       |
| 保存配置  | `career_model_save`        | `save`                       |
| 启用/关闭 | `career_model_set_enabled` | `setEnabled`                 |
| 清除配置  | `career_model_clear`       | `clear`                      |
| 模型请求  | `career_model_request`     | `request`                    |

保存接收 `{provider, baseUrl, model, apiKey, enabled}`。读取/保存返回的设置只有 `{provider, baseUrl, model, configured, enabled}`，不包含密钥。`requestModel` 接收 `system`/`user` 消息与 `maxTokens`，返回 `{content, provider, model}`。

供应商协议为 HTTPS Bearer API Key + `/chat/completions`。Base URL 应保留供应商需要的版本前缀，不填最后的 `/chat/completions`。例如完整地址为 `https://example.com/v1/chat/completions` 时，Base URL 填 `https://example.com/v1`。看山真实文档未取得，需要领取额度后核实，不能据此宣称已经完成看山联调。

网页预览没有原生模型插件，保持本机模式。此前独立 Python 网关的 `/api/career/*` 路由不属于本安装版；新增多轮聊天或云端规划界面需另行接入。
