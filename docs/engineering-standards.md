# 工程规范

- TypeScript strict 模式；改动后执行 `npm run typecheck`。
- 业务规则放在 `lib/`，页面只负责用户交互与渲染。
- `npm test` 执行域逻辑单测，CI 执行 lint、类型检查、单测与静态构建。
- ESLint flat config 与 Prettier 提供一致格式化；`npm run format:check` 用于 CI。
- 使用 Conventional Commit 风格，例如 `feat(android): add native share`、`fix(home): preserve empty profile state`。
- 不提交凭证、用户简历、构建缓存、签名密钥或未授权的岗位数据。
- 面向求职者的结论必须显示依据和不确定性；不得虚构招聘、工资、成功率或用户业绩。
