# BeePilot Phase 1 正式开发计划

存档日期：2026-05-07

## 1. 阶段目标

Phase 1 的目标是把 BeePilot 从静态原型推进到可运行的正式工程底座。

本阶段不再做 mock 演示，重点是：

- 建立正式 monorepo。
- 建立 Admin Console、Widget、API Gateway 三个核心工程。
- 建立真实数据库模型和 migration。
- 跑通 Widget 创建会话、发送消息、保存消息的基础链路。
- 为 Phase 2 AI Provider 集成和 Phase 3 Conversation Channel 集成预留接口与配置。

Phase 1 不要求完成真实 AI 回答，也不要求完成人工接管，但所有核心边界必须按正式系统设计。默认主线为 BeeWorksAI + 自家 IM；Dify、Chatwoot 均作为可选适配器保留。

## 2. 技术栈确认

### 2.1 前端

- React
- TypeScript
- Vite
- CSS Modules 或 Tailwind 二选一，建议先用 CSS Modules，减少 UI 风格锁定。
- Admin Console 和 Widget 分开构建。

### 2.2 后端

锁定采用：

- Node.js
- TypeScript
- Fastify

原因：

- Gateway 更偏 API 编排和集成服务，Fastify 足够轻量。
- 比 NestJS 更少框架约束，适合早期快速推进。
- 后续也可以拆 service 层，不影响演进。
- AI Provider、Conversation Channel、CRM、工单和通知系统都通过 HTTP API / Webhook 集成，Fastify 的插件化路由和 schema 校验足够覆盖一期需求。

### 2.3 数据与基础设施

- PostgreSQL
- Prisma
- Redis
- BullMQ
- Docker Compose

Phase 1 中 Redis / BullMQ 可以先加入工程和 docker 环境，但业务队列可以到 Phase 2/3 再实用化。

## 3. 推荐 monorepo 结构

```text
BeePilot/
  apps/
    admin/
      src/
      index.html
      vite.config.ts
    widget/
      src/
      index.html
      vite.config.ts
    api/
      src/
        server.ts
        config/
        routes/
        services/
        integrations/
        repositories/
        schemas/
      prisma/
        schema.prisma
  packages/
    shared/
      src/
        types/
        constants/
        validation/
    ui/
      src/
  prototypes/
    site/
      official.html
      admin.html
      src/
      assets/
  docs/
  docker-compose.yml
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  .env.example
```

当前静态原型建议移动到：

```text
prototypes/site/
```

这样正式工程和设计原型边界清楚。

## 4. Phase 1 交付范围

### 4.1 工程脚手架

交付：

- 根目录 `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.env.example`
- `docker-compose.yml`
- `apps/admin`
- `apps/widget`
- `apps/api`
- `packages/shared`

验收：

- `pnpm install` 可安装依赖。
- `pnpm dev` 可同时启动 Admin、Widget、API。
- `pnpm build` 可构建所有应用。
- `docker compose up` 可启动 PostgreSQL 和 Redis。

### 4.2 API Gateway 基础服务

交付：

- Fastify server。
- 健康检查接口。
- 环境变量配置。
- 请求日志。
- 错误响应格式。
- CORS 配置。
- API 路由分组。

基础接口：

```http
GET /health
GET /api/version
POST /api/widget/conversations
POST /api/widget/messages
GET /api/admin/overview
GET /api/admin/conversations
```

验收：

- API 可本地启动。
- 健康检查可访问。
- Widget 可以创建 conversation。
- Widget 可以发送 message。
- Admin 可以读取 conversation 列表。

### 4.3 数据库模型

Phase 1 必建表：

- `tenants`
- `widgets`
- `visitors`
- `conversations`
- `messages`
- `events`

Phase 1 可预留但不必完整实现：

- `leads`
- `support_requests`
- `answer_feedback`
- `integrations`
- `workflow_configs`

验收：

- Prisma migration 可执行。
- 数据库表结构和文档一致。
- 创建会话和消息时写入真实数据库。

## 5. Phase 1 数据模型细化

### 5.1 Tenant

最小字段：

- `id`
- `name`
- `slug`
- `status`
- `created_at`
- `updated_at`

Phase 1 默认初始化一个租户：

- `BeeWorks`

### 5.2 Widget

最小字段：

- `id`
- `tenant_id`
- `name`
- `public_key`
- `allowed_domains`
- `theme`
- `welcome_message`
- `quick_prompts`
- `enabled`
- `created_at`
- `updated_at`

### 5.3 Visitor

最小字段：

- `id`
- `tenant_id`
- `anonymous_id`
- `name`
- `company`
- `phone`
- `email`
- `first_seen_at`
- `last_seen_at`

### 5.4 Conversation

最小字段：

- `id`
- `tenant_id`
- `widget_id`
- `visitor_id`
- `status`
- `primary_intent`
- `source_url`
- `attribution`
- `chatwoot_conversation_id`
- `created_at`
- `updated_at`

### 5.5 Message

最小字段：

- `id`
- `conversation_id`
- `role`
- `content`
- `intent`
- `sources`
- `metadata`
- `created_at`

`role` 枚举：

- `visitor`
- `assistant`
- `agent`
- `system`

### 5.6 Event

最小字段：

- `id`
- `tenant_id`
- `conversation_id`
- `visitor_id`
- `event_name`
- `payload`
- `attribution`
- `created_at`

## 6. API 设计细化

### 6.1 创建会话

```http
POST /api/widget/conversations
```

请求：

```json
{
  "widget_public_key": "wpk_xxx",
  "anonymous_id": "anon_xxx",
  "source_url": "https://beeworks.cn/",
  "attribution": {
    "utm_source": "baidu",
    "bd_vid": "xxx"
  }
}
```

响应：

```json
{
  "conversation_id": "conv_xxx",
  "visitor_id": "vis_xxx",
  "welcome_message": "你好，我是 BeePilot AI 顾问。",
  "quick_prompts": []
}
```

### 6.2 发送消息

```http
POST /api/widget/messages
```

请求：

```json
{
  "conversation_id": "conv_xxx",
  "content": "我们 500 人私有化部署多少钱？"
}
```

Phase 1 响应：

```json
{
  "message_id": "msg_xxx",
  "reply": {
    "message_id": "msg_xxx",
    "role": "assistant",
    "content": "消息已收到。AI 回答将在 AI Provider 集成阶段启用。",
    "intent": "unknown",
    "sources": []
  }
}
```

说明：

- Phase 1 不做假业务回答。
- 只做正式消息入库和占位响应。
- Phase 2 将占位响应替换为已启用 AI Provider 返回。

### 6.3 管理端会话列表

```http
GET /api/admin/conversations
```

响应：

```json
{
  "items": [
    {
      "id": "conv_xxx",
      "visitor": {},
      "status": "open",
      "primary_intent": null,
      "message_count": 2,
      "created_at": "2026-05-07T10:00:00Z"
    }
  ]
}
```

## 7. AI Provider 集成预留

Phase 1 不接真实 AI Provider，但需要预留配置表和 service 边界。BeeWorksAI 是默认 Provider；Dify、OpenAI、Customer API 作为可选 Provider，但都不能进入 BeePilot 的核心数据模型。

Provider API Key 只能由服务端持有，Widget、Admin Console、IM 不允许直接调用 BeeWorksAI、Dify、OpenAI 或客户模型网关。所有 AI 请求必须经由 BeePilot AI Gateway。

### 7.1 环境变量

```env
DIFY_BASE_URL=
DIFY_API_KEY=
DIFY_APP_ID=
```

### 7.2 Service 边界

建议预留：

```text
apps/api/src/ai/
  ai-provider.types.ts
  ai-provider.registry.ts
  ai-orchestration.service.ts
  providers/
    disabled.provider.ts
    dify.provider.ts
```

Phase 1 中只实现 `disabled` provider，后续 Provider 均通过同一接口接入。

### 7.3 ID 映射策略

BeePilot 必须使用自己的 `conversation.id` 作为主键。

后续接入 Dify 时，保存映射字段：

- `conversation.external_ai_provider`
- `conversation.external_ai_conversation_id`
- `message.external_ai_provider`
- `message.external_ai_message_id`

原因：

- Dify、自研 RAG、OpenAI Assistants、客户模型网关都可能有自己的 conversation/message 标识。
- Chatwoot 也有自己的 conversation/message 标识。
- BeePilot 需要独立维护租户、访客、归因、线索和业务动作，不能依赖任一外部系统 ID 作为主键。

### 7.4 响应模式策略

Phase 2 建议先支持 blocking 响应，确认链路稳定后再支持 streaming。

原因：

- blocking 更容易调试、落库和错误处理。
- streaming 需要处理 SSE、前端逐字渲染、中断、重试和部分消息落库。
- Widget 交互稳定后再补流式输出，风险更低。

## 8. Conversation Channel 集成预留

Phase 1 不接真实人工通道，但需要预留配置表和 service 边界。默认通道为自家 IM；Chatwoot 作为可选开源客服适配器。

Conversation Channel 的 API Token 只能由服务端持有，Widget 不允许直接调用自家 IM / Chatwoot。人工接管由 BeePilot AI Gateway 通过 Conversation Channel Adapter 创建或更新外部会话。

### 8.1 环境变量

```env
CHATWOOT_BASE_URL=
CHATWOOT_API_TOKEN=
CHATWOOT_ACCOUNT_ID=
CHATWOOT_INBOX_ID=
```

### 8.2 Service 边界

建议预留：

```text
apps/api/src/integrations/chatwoot/
  chatwoot.client.ts
  chatwoot.types.ts
  chatwoot.service.ts
```

Phase 1 中 `chatwoot.service.ts` 只提供接口定义和 disabled 实现。

### 8.3 ID 映射策略

后续接入自家 IM / Chatwoot 时，保存映射字段：

- `visitor.chatwoot_contact_id`
- `conversation.chatwoot_conversation_id`

同步原则：

- 用户消息、AI 回答和人工消息写入 BeePilot 标准会话主库。
- 需要触达外部通道时，通过 Conversation Channel Adapter 同步到自家 IM / Chatwoot。
- 人工接管状态由 BeePilot conversation 状态和外部 channel 状态共同决定。
- 外部 channel 默认 widget 不作为 BeePilot 前台入口，除非客户明确选择该通道自带入口。

### 8.4 同步策略

Phase 3 初期可同步写入自家 IM；稳定后改为队列异步同步。Chatwoot 后续作为第二适配器。

建议：

- Phase 3 POC：API 请求内同步自家 IM，方便调试。
- 正式上线：通过 BullMQ 异步同步 Conversation Channel，避免外部通道抖动影响用户对话。

## 9. Widget 第一版

Phase 1 的 Widget 不需要完整营销视觉，但要可嵌入、可运行。

交付：

- 浮动按钮。
- 右侧聊天面板。
- 会话初始化。
- 消息发送。
- 消息列表。
- 加载状态。
- 错误状态。
- 基础主题配置。

不做：

- 复杂动作卡片。
- 真实 AI 回复。
- 人工接管。
- 表单提交。

这些进入 Phase 2/3/4。

## 10. Admin Console 第一版

Phase 1 的 Admin Console 连接真实 API。

交付：

- 登录暂不做，默认本地开发访问。
- Overview：读取真实统计。
- Conversations：读取真实会话列表。
- Conversation Detail：查看消息。
- Integrations：展示 AI Provider / Conversation Channel 配置状态。

不做：

- 完整权限。
- 工作流编辑器。
- 知识库管理。
- 线索处理。

这些进入后续阶段。

## 11. 开发顺序

建议按以下顺序执行：

1. 整理目录：将当前静态文件移动到 `prototypes/site`。
2. 初始化 pnpm monorepo。
3. 创建 `apps/api`。
4. 加入 PostgreSQL、Redis、Prisma。
5. 建立基础 schema 和 migration。
6. 实现 `/health`。
7. 实现 conversation/message API。
8. 创建 `apps/widget`，接入 conversation/message API。
9. 创建 `apps/admin`，读取 overview/conversations。
10. 预留 AI Provider 和 Conversation Channel service 边界。
11. 写 README 和本地启动说明。

## 11.1 工程初始化任务清单

下一步正式动工时，按这个顺序执行。

### Step 1：归档当前静态原型

操作：

- 创建 `prototypes/site/`。
- 将当前静态官网、后台原型、设计画板相关文件移动进去。
- 保留 `docs/` 在根目录。

移动范围：

- `official.html`
- `admin.html`
- `ai-plg.html`
- `index.html`
- `index-bundle.html`
- `index-print.html`
- `BeeWorks Redesign.html`
- `src/`
- `assets/`
- `snapshots/`
- `design-canvas.jsx`
- `tweaks-panel.jsx`

验收：

- 根目录只保留正式工程文件、`docs/`、`prototypes/`。
- 原型仍可通过静态服务在 `prototypes/site` 下访问。

### Step 2：初始化 pnpm workspace

新增：

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.gitignore`
- `.env.example`

根脚本：

```json
{
  "dev": "pnpm -r --parallel dev",
  "build": "pnpm -r build",
  "typecheck": "pnpm -r typecheck",
  "lint": "pnpm -r lint"
}
```

### Step 3：创建基础应用目录

新增：

- `apps/api`
- `apps/admin`
- `apps/widget`
- `packages/shared`

Phase 1 初始原则：

- API 先能启动。
- Admin 先能读取 API。
- Widget 先能创建 conversation。
- shared 只放类型和常量，不提前抽复杂 UI。

### Step 4：接入 Docker Compose

新增服务：

- `postgres`
- `redis`

默认端口：

- PostgreSQL：`5432`
- Redis：`6379`
- API：`4300`
- Admin：`5173`
- Widget playground：`5174`

### Step 5：建立 Prisma schema

先实现：

- Tenant
- Widget
- Visitor
- Conversation
- Message
- Event

并提供 seed：

- 默认租户：BeeWorks
- 默认 Widget：BeeWorks 官网 AI 顾问

### Step 6：实现最小 API

顺序：

1. `GET /health`
2. `POST /api/widget/conversations`
3. `POST /api/widget/messages`
4. `GET /api/admin/overview`
5. `GET /api/admin/conversations`
6. `GET /api/admin/conversations/:id`

### Step 7：实现最小前端

Admin：

- Overview
- Conversations list
- Conversation detail
- Integrations status

Widget：

- Floating launcher
- Chat panel
- Conversation init
- Send message
- Render visitor / assistant messages

### Step 8：预留集成边界

新增 disabled implementations：

- `ai/providers/disabled.provider.ts`
- `chatwoot.service.ts`

接口先稳定，真实实现进入 Phase 2 / Phase 3。

## 12. 验收场景

Phase 1 完成后必须能演示：

1. 启动 PostgreSQL、Redis、API、Admin、Widget。
2. 打开 Widget 页面。
3. Widget 自动创建 visitor 和 conversation。
4. 用户发送一条消息。
5. API 保存 visitor、conversation、message。
6. API 返回正式占位 assistant 消息。
7. Admin Console 看到该 conversation。
8. Admin Console 打开 conversation detail 看到消息记录。

## 13. 不做清单

Phase 1 明确不做：

- 不接真实 AI Provider 回答。
- 不接真实人工通道收件箱。
- 不做 CRM 集成。
- 不做工单集成。
- 不做付费套餐。
- 不做多租户 UI。
- 不做完整 RBAC。
- 不做复杂工作流编辑器。

这些不是砍掉，而是避免 Phase 1 膨胀。

## 14. 风险与前置条件

### 14.1 AI Provider / Conversation Channel 版本

后续 Phase 2/3 需要锁定部署版本和 API 能力，避免接口变化。

### 14.2 License

BeeWorksAI、自家 IM、Dify、Chatwoot 以及其他可能启用的 Provider / Channel license 需要在商业化前做一次正式审查。

### 14.3 多租户

Phase 1 数据模型必须带 `tenant_id`，即使 UI 暂时只有 BeeWorks 一个租户。

### 14.4 Widget 安全

Widget 必须使用 `widget_public_key` 和域名白名单，不能暴露服务端密钥。

### 14.5 数据合规

消息和联系方式属于客户数据，后续 SaaS 和私有化部署需要分别设计数据保留、导出和删除策略。

## 15. Phase 1 完成定义

满足以下条件，Phase 1 才算完成：

- 工程结构稳定。
- 本地开发环境一条命令可启动。
- 数据库 migration 可重复执行。
- Widget 可以创建真实会话。
- Widget 可以发送真实消息。
- Admin 可以查看真实会话和消息。
- AI Provider / Conversation Channel 集成边界已经预留。
- README 说明清楚。
- 当前静态原型已归档，不再混在正式工程根逻辑里。

## 16. 当前执行状态

更新时间：2026-05-07

已完成：

- 当前静态原型已归档到 `prototypes/site/`。
- 已初始化 pnpm workspace。
- 已创建 `apps/api`、`apps/admin`、`apps/widget`、`packages/shared`。
- 已创建 Docker Compose 配置：PostgreSQL、Redis。
- 已创建 Prisma schema：Tenant、Widget、Visitor、Conversation、Message、Event。
- 已创建默认 seed：BeeWorks 租户和 BeeWorks 官网 AI 顾问 Widget。
- 已实现 API Gateway 基础接口：
  - `GET /health`
  - `GET /api/version`
  - `POST /api/widget/conversations`
  - `POST /api/widget/messages`
  - `GET /api/admin/overview`
  - `GET /api/admin/conversations`
  - `GET /api/admin/conversations/:id`
- 已预留 AI Provider disabled service。
- 已预留 Conversation Channel disabled service。
- 已创建 Admin Console 最小页面。
- 已新增 Admin Console 的 AI Provider 配置入口。
- 已新增 AI Provider 配置读取、保存和测试 API。
- 已新增服务端 API Key 加密存储工具。
- 已新增 Dify Provider blocking 模式实现，启用 `dify` provider 时由 Gateway 调用 Dify `/chat-messages`。
- 已新增 Customer Request 数据模型、Widget 留资/转人工/试用请求 API 和 Admin 请求列表。
- 已创建并应用 Prisma 初始 migration：`20260507150014_init`。
- 已完成本地 PostgreSQL seed，并验证 AI Provider 配置读取、测试、保存链路。
- 已创建 Widget Playground 最小页面。
- 已新增 README。

已验证：

- `corepack pnpm install`
- `corepack pnpm db:generate`
- `corepack pnpm typecheck`
- `corepack pnpm build`
- `DATABASE_URL=... prisma validate`
- API `/health` 冒烟测试通过。

未完成：

- 本机当前没有 `docker` 命令，因此尚未执行 `docker compose up -d`。
- 尚未执行真实 PostgreSQL migration。
- 尚未执行 seed 到真实数据库。
- 尚未完成 Widget -> API -> DB -> Admin 的数据库闭环验证。

下一步：

1. 在具备 Docker 的环境启动 PostgreSQL 和 Redis。
2. 执行 `corepack pnpm db:migrate`。
3. 执行 `corepack pnpm db:seed`。
4. 启动 API、Admin、Widget。
5. 验证 Widget 创建会话和发送消息后，Admin 能看到真实会话记录。
