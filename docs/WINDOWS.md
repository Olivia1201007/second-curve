# Windows 桌面版（4.1.0）

可在 Windows 本机或 GitHub Actions Windows runner 构建 Tauri 安装包。安装后从开始菜单启动 SECOND CURVE。Web 静态文件随安装包发布，运行期职业档案保存在应用本机浏览器存储中。未签名体验包可能触发 Windows SmartScreen 未知发布者提示；正式商用分发需要代码签名证书。

4.1.0 增加随应用打包的 Rust 原生云模型调用。在「个人中心 → 云模型设置」配置本人平台的地址、模型 ID 和 Key，保存后主动启用。Key 保存在 Windows 凭据管理器；软件不含团队共享 Key，也无需 Python 或项目服务器。云模型使用时需要联网，本机规则和本地档案可离线使用。

看山真实凭证尚未取得，需领取后核对协议。新版安装包构建与实际安装检查结果以本次交付记录为准。运行期需要 Microsoft WebView2 Runtime。
