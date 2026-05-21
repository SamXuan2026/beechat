# BeeChat / BeePilot 文档索引

本目录统一存放 BeeChat 工程文档与 BeePilot 产品规划文档。

## HTML 输出

项目内所有 Markdown 文档统一生成同路径 HTML 文件，便于浏览器查看与交付归档。

```text
npm run docs:build
```

生成规则：

- `README.md` 输出为 `README.html`。
- `docs/beechat/API.md` 输出为 `docs/beechat/API.html`。
- `design/beechat/DESIGN_SPEC.md` 输出为 `design/beechat/DESIGN_SPEC.html`。
- HTML 统一使用本地 Tailwind CSS 编译后的 `docs/assets/docs.css` 排版样式，可离线浏览。
- Tailwind 源文件为 `docs/assets/docs.tailwind.css`，配置文件为 `tailwind.docs.config.js`。

## BeeChat 工程文档

```text
docs/beechat/API.html             BeeChat MVP 接口文档
docs/beechat/DEPLOYMENT.html      BeeChat 部署说明
docs/beechat/DATABASE_PLAN.html   BeeChat 数据库适配方案
docs/beechat/REQUIREMENTS.html    BeeChat 需求文档
docs/beechat/DESIGN.html          BeeChat 设计文档
docs/beechat/ITERATION_PLAN.html  BeeChat 后续迭代计划
docs/beechat/ROADMAP.html         BeeChat 产品与技术路线图
docs/beechat/FRONTEND_REFACTOR_PLAN.html  BeeChat 前端工程化改造方案
docs/beechat/TESTING.html         BeeChat 测试说明与报告索引
```

## BeePilot 产品文档

```text
docs/beepilot/product-roadmap-and-architecture.html  BeePilot 产品 Roadmap 与技术框架
docs/beepilot/phase1-implementation-plan.html        BeePilot Phase 1 正式开发计划
docs/beepilot/functional-scope.html                  BeePilot 功能范围
docs/beepilot/conversation-channel-adapter.html      Conversation Channel 适配说明
```

## BeePilot 参考资料

```text
docs/beepilot/references/beeworks-ai-advisor-system-roadmap.html
docs/beepilot/references/beeworks-ai-plg-homepage-plan.html
```

## 归档规则

- BeeChat 工程实现、接口、部署、迭代文档放入 `docs/beechat/`。
- BeePilot 产品路线、阶段计划、功能范围、架构边界放入 `docs/beepilot/`。
- BeeWorks、官网、AI Advisor 等背景材料放入 `docs/beepilot/references/`。
- 设计稿、截图、Pencil/Figma 导出文件放入 `design/`。
