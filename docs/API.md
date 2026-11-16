# API 与服务接口

当前发行版是静态应用，**没有 HTTP API**。`CareerProvider` 是浏览器侧的本地服务接口，用于保持经历分析、岗位文本匹配、表达润色与界面分离。

未来服务端接入建议统一返回：

```json
{"ok":true,"data":{},"error":null,"requestId":"opaque-id"}
```

错误形态：`{"ok":false,"data":null,"error":{"code":"UPSTREAM_TIMEOUT","message":"服务暂时不可用，请稍后重试"},"requestId":"opaque-id"}`。验证 schema、限制上传体积与文本长度、在服务端设置连接超时与有界重试；不要把简历正文写入日志。API 密钥放在服务端 secret store。
