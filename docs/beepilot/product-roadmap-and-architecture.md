# BeePilot 产品 Roadmap 与技术框架

存档日期：2026-05-07

## 1. 产品命名

产品名：**BeePilot**

中文定位：**BeePilot 企业 AI 客户互动平台**

一句话描述：

> BeePilot 是面向企业的 AI 客户互动平台，基于企业知识库、AI 工作流和人工接管体系，统一承接售前咨询、客户服务、线索转化、试用引导、报价申请与售后支持。

BeePilot 不只是 BeeWorks 官网的 AI 顾问，而是可以独立产品化、交付给任意企业客户的 AI 客服与知识运营平台。

## 2. 产品边界

BeePilot 覆盖：

- AI 客服
- AI 售前
- AI 知识库问答
- AI 线索转化
- AI 售后支持
- 人工接管
- 会话记录
- 知识库运营
- 回答优化
- 客户互动分析

BeePilot 不直接替代：

- CRM
- 工单系统
- 在线支付系统
- 企业知识管理主系统
- 企业 IM
- AI 应用编排平台

这些系统作为集成目标，由 BeePilot 通过 API、Webhook、企业微信、邮件或数据仓库对接。

### 2.1 已确认的架构边界原则

以下原则作为后续系统架构和产品设计依据：

- BeePilot 是 **AI 客服与增长业务中台**，不是 Dify/BeeWorksAI 的替代品，也不是 IM/Chatwoot 的替代品。
- BeeWorksAI / Dify 是 **AI 应用运行时**，负责知识库、RAG、Prompt/Workflow、Agent、模型调用和回答生成。
- 自家 IM / Chatwoot / 企业微信 / 飞书是 **Conversation Channel**，负责消息触达、人工工作台、坐席接待和通知。
- BeePilot 是 **会话业务主库 + 策略执行层 + 运营分析层**，负责访客、会话、消息、线索、归因、行为事件、质检和转化数据。
- IM 不直接对接 BeeWorksAI。IM 只对接 BeePilot；BeePilot 统一对接 BeeWorksAI / Dify / OpenAI / 客户自有 AI。
- BeePilot 可以让 AI 参与判断，但最终动作由 BeePilot 策略执行。即：AI 给建议，BeePilot 校验、记录、执行和审计。
- BeePilot 不重造 AI Workflow Studio 的复杂能力。知识库、RAG、模型、Agent 和工作流优先交给 BeeWorksAI / Dify。
- BeePilot 的核心价值是把 AI 判断转化为可控业务动作：是否回复客户、是否给坐席建议、是否转人工、是否留资、是否计入线索、是否触发售后流程。
- 会话数据是 BeePilot 的核心资产。AI 消息和人工消息都应标准化沉淀到 BeePilot，便于分析、质检、线索评分、知识优化和后续商业化。
- Chatwoot、Dify 都是适配器选项，不是默认核心依赖。默认主线调整为：**BeePilot + BeeWorksAI + 自家 IM**。

## 3. 目标客户

优先客户类型：

1. B2B 软件公司
2. 企业服务公司
3. 私有化交付型软件厂商
4. 有复杂售前咨询链路的企业
5. 有大量售后 FAQ 和客服压力的企业
6. 需要将官网、客服、知识库和销售线索打通的组织

典型使用场景：

- 官网 AI 顾问
- 产品文档 AI 问答
- 售前方案咨询
- 报价和试用申请
- 售后智能客服
- 人工客服辅助
- 客户成功知识库
- 渠道线索分发

## 4. 核心价值

BeePilot 的核心价值是把企业对外客户互动从“人工被动响应”升级为“AI 主动承接 + 人工高效接管”。

价值点：

- 降低客户理解复杂产品的门槛。
- 提升官网和文档站的咨询转化率。
- 降低售前和客服重复问答成本。
- 通过知识库让 AI 回答可控、可追溯。
- 用人工接管保障高风险问题和关键客户体验。
- 沉淀会话数据，持续优化产品话术、知识库和销售流程。

## 5. 产品模块

### 5.1 AI Chat Widget

面向终端用户的前台入口。

能力：

- 网站嵌入式聊天侧边栏
- 独立聊天页
- 快捷问题
- 多轮对话
- 来源引用
- 留资卡片
- 试用卡片
- 报价卡片
- 售后请求卡片
- 转人工入口
- 移动端适配

### 5.2 Knowledge Hub

企业知识库运营中心。

能力：

- 展示和管理 BeePilot 侧知识库入口配置。
- 记录知识库版本、AI 应用 ID、Provider ID 和命中效果。
- 支持跳转或嵌入 BeeWorksAI / Dify 的知识库管理界面。
- 沉淀知识缺口、错误回答、待补充问题和运营建议。

说明：知识切片、向量检索、RAG 召回排序、知识库训练和发布优先由 BeeWorksAI / Dify 承担，BeePilot 不在一期重造这些能力。

### 5.3 AI Policy & Action Studio

AI 业务策略和动作配置中心。

一期内置：

- 产品咨询
- 行业方案
- 报价咨询
- 试用申请
- 售后支持
- 转人工

后续扩展：

- 自定义意图
- 自定义字段
- 自定义动作
- 风险等级
- 策略阈值
- 人工复核
- 动作审计

说明：复杂 LLM Workflow、Agent 编排、多节点 Prompt 流程由 BeeWorksAI / Dify 承担。BeePilot 只配置业务策略：AI 的判断结果如何转化成回复、留资、转人工、打标签、建工单、通知销售等动作。

### 5.4 Conversation Inbox

客户会话管理与人工接管。

能力：

- 会话记录
- 客户资料
- AI 摘要
- 意图标签
- 人工接管
- 团队分配
- 内部备注
- 客户上下文
- 会话状态

该模块优先接入自家 IM 作为默认人工会话通道；Chatwoot 作为开源客服适配器保留。无论底层通道是哪一个，BeePilot 都保留标准化会话主库。

### 5.5 Lead & Request Center

线索、试用、报价、售后请求中心。

能力：

- 销售线索
- 试用申请
- 报价申请
- 演示预约
- 售后请求
- 工单同步
- CRM 同步
- CSV 导出
- 企业微信/邮件通知

### 5.6 Answer Optimization

回答优化闭环。

能力：

- 回答评分
- 错误回答标记
- 未命中问题
- 高频问题聚类
- 一键沉淀 FAQ
- 知识缺口提醒
- 风险回答回放
- 人工修正建议

### 5.7 Analytics & Attribution

客户互动分析。

能力：

- AI 打开率
- 快捷问题点击率
- 问题解决率
- 知识库命中率
- 人工接管率
- 留资转化率
- 试用申请率
- 报价申请率
- 售后自助解决率
- 渠道归因
- 会话质量分析

## 6. 技术选型

BeePilot 采用“自研产品层 + 开源底座 + 企业集成”的架构。

### 6.1 前台与产品层

自研：

- BeePilot Web Widget
- BeePilot Admin Console
- BeePilot AI Gateway
- BeePilot 数据模型
- BeePilot 业务 API
- BeePilot 埋点与分析层

原因：

- 保证品牌体验。
- 保证产品可控。
- 保证业务流程、线索和风控可扩展。
- 避免把客户前台体验绑定到第三方默认 widget。

### 6.2 AI 与知识库底座

优先实现：**AI Provider 抽象层**

BeePilot 不把 Dify 或 BeeWorksAI 写死为产品内核。默认主线采用 BeeWorksAI，但必须通过统一的 AI Provider 接口接入，未来可以替换为 Dify、OpenAI / Azure OpenAI、客户自有模型网关或其他工作流平台。

AI Provider 职责：

- 知识库
- RAG 检索
- Workflow
- Agent 编排
- 模型接入
- 回答生成
- 来源引用
- AI 运行日志

BeePilot 与具体 Provider 的关系：

- BeePilot Gateway 只调用统一 AI Provider 接口。
- BeeWorksAI 是默认 `beeworks_ai` provider，Dify 是 `dify` provider，二者都不进入核心数据模型。
- BeePilot Admin 提供租户级 AI Provider 配置入口。
- BeePilot Gateway 将用户上下文、会话状态、业务策略参数注入 Provider。
- 会话、消息、访客、线索、归因和运营数据始终归 BeePilot 自己管理。
- BeePilot 不实现知识库切片、向量召回、Prompt 工作流编排、多 Agent 流程等 AI 应用运行时能力。
- BeePilot 只保存 Provider 配置、调用记录、AI 决策结果、命中效果和业务执行结果。

### 6.3 会话与人工接管底座

默认采用：**自家 IM**

Conversation Channel 职责：

- 会话收件箱
- 客户资料
- 人工接管
- 团队分配
- 标签
- 内部备注
- 多渠道会话
- 客服协作

BeePilot 与 Conversation Channel 的关系：

- 自家 IM 是默认通道，Chatwoot 是可选开源客服适配器。
- IM / Chatwoot 不直接访问 BeeWorksAI。
- IM / Chatwoot 通过 BeePilot 获取 AI 自动回复、Agent Assist 建议、会话摘要和知识引用。
- 人工客服可在 IM / Chatwoot 中接待，但消息需要同步回 BeePilot 标准会话主库。
- BeePilot Admin 展示完整 AI + 人工会话、访客资料、线索、归因和质检结果。
- BeePilot 通过 Conversation Channel Adapter 对接自家 IM、Chatwoot、企业微信、飞书、Zendesk 等通道。

### 6.4 自研 AI Gateway

BeePilot AI Gateway 是核心自研层。

职责：

- 管理访客会话 ID
- 接收前台消息
- 调用 AI Provider 获取 AI 回答
- 同步用户消息、AI 回答和人工消息到 BeePilot 标准会话主库
- 通过 Conversation Channel Adapter 向 IM / Chatwoot 等通道发送消息或状态变更
- 判断是否触发人工接管
- 创建线索、报价、试用、售后请求
- 执行业务策略、风控规则和动作审计
- 处理渠道归因
- 记录行为事件
- 保护 AI Provider 和 Conversation Channel API Key
- 对接 CRM、工单、企业微信、邮件和数据仓库

### 6.5 AI Decision、Policy Engine 与 Action Executor

BeePilot 允许 AI 参与业务判断，但不把最终控制权完全交给 AI。

标准链路：

```text
AI Decision
  ↓
BeePilot Policy Engine
  ↓
Action Executor
```

AI Decision 可以由 BeeWorksAI / Dify 返回：

- intent
- confidence
- lead_score
- risk_level
- suggested_action
- handoff_required
- reply_mode
- required_fields

BeePilot Policy Engine 负责：

- 校验 AI 输出 schema。
- 应用租户配置、风险规则和阈值。
- 决定是否回复客户、是否只给坐席建议、是否转人工、是否留资、是否通知销售、是否创建售后请求。
- 对高风险动作加规则兜底和人工复核。

Action Executor 负责：

- 发送消息。
- 展示留资/报价/试用卡片。
- 创建线索或售后请求。
- 同步 IM / Chatwoot 状态。
- 写入事件、审计和分析数据。

原则：AI 给建议，BeePilot 负责执行和审计。

### 6.6 Agent Assist

Agent Assist 是人工客服辅助能力，不是前台 AI 自动回复。

关系：

```text
人工客服 / IM 工作台
        ↓
BeePilot Agent Assist API
        ↓
BeeWorksAI / Dify
```

BeePilot 提供：

- 推荐回复
- 会话摘要
- 用户意图
- 知识库引用
- 下一步动作建议
- 风险提醒
- 售后 SOP
- 报价/试用流程提示

IM 只调用 BeePilot Agent Assist API，不直接调用 BeeWorksAI。BeePilot 负责组装上下文、调用 AI Provider、保存建议、记录是否采纳。

## 7. 参考架构

```text
客户网站 / BeeWorks 官网
        ↓
BeePilot Web Widget / 自家 IM / Chatwoot / 企业微信 / 飞书
        ↓
Conversation Channel Adapter
        ↓
BeePilot Conversation Store + Policy Engine
        ↓
 ┌─────────────────────┬─────────────────────┐
 │ AI Provider          │ Human Channel        │
 │ BeeWorksAI / Dify    │ 自家 IM / Chatwoot   │
 └─────────────────────┴─────────────────────┘
        ↓
CRM / 工单 / 企业微信 / 邮件 / 数据仓库 / BI
```

## 8. 核心数据模型

### 8.1 Tenant

企业租户。

字段：

- `id`
- `name`
- `domain`
- `plan`
- `ai_provider_config_id`
- `chatwoot_account_id`
- `status`
- `created_at`

### 8.2 Widget

客户网站嵌入配置。

字段：

- `id`
- `tenant_id`
- `name`
- `allowed_domains`
- `theme`
- `welcome_message`
- `quick_prompts`
- `enabled_workflows`
- `handoff_enabled`

### 8.3 Visitor

访客或客户。

字段：

- `id`
- `tenant_id`
- `anonymous_id`
- `name`
- `company`
- `phone`
- `email`
- `external_customer_id`
- `first_seen_at`
- `last_seen_at`

### 8.4 Conversation

会话。

字段：

- `id`
- `tenant_id`
- `visitor_id`
- `widget_id`
- `chatwoot_conversation_id`
- `status`
- `primary_intent`
- `handoff_status`
- `source_url`
- `attribution`
- `created_at`
- `updated_at`

### 8.5 Message

消息。

字段：

- `id`
- `conversation_id`
- `role`
- `content`
- `intent`
- `external_ai_provider`
- `external_ai_message_id`
- `sources`
- `confidence`
- `created_at`

### 8.6 Lead

线索。

字段：

- `id`
- `tenant_id`
- `conversation_id`
- `type`
- `company`
- `contact_name`
- `phone`
- `email`
- `industry`
- `user_count`
- `deployment_type`
- `modules`
- `status`
- `crm_external_id`

### 8.7 SupportRequest

售后请求。

字段：

- `id`
- `tenant_id`
- `conversation_id`
- `customer_name`
- `issue_type`
- `priority`
- `description`
- `status`
- `ticket_external_id`

### 8.8 AnswerFeedback

回答反馈。

字段：

- `id`
- `tenant_id`
- `conversation_id`
- `message_id`
- `rating`
- `reason`
- `operator_note`
- `created_by`
- `created_at`

## 9. API 设计

### 9.1 前台 Widget API

```http
POST /api/widget/conversations
POST /api/widget/messages
POST /api/widget/handoff
POST /api/widget/leads
POST /api/widget/support-requests
POST /api/widget/events
```

### 9.2 管理后台 API

```http
GET /api/admin/overview
GET /api/admin/conversations
GET /api/admin/leads
GET /api/admin/support-requests
GET /api/admin/answer-feedback
GET /api/admin/integrations
PATCH /api/admin/widgets/:id
PATCH /api/admin/workflows/:id
```

### 9.3 集成 API

```http
POST /api/integrations/ai-provider/chat
POST /api/integrations/chatwoot/conversations
POST /api/integrations/chatwoot/messages
POST /api/integrations/crm/leads
POST /api/integrations/tickets
POST /api/integrations/notifications
```

## 10. AI 工作流

一期内置工作流：

1. 产品咨询
2. 行业方案
3. 报价咨询
4. 试用申请
5. 售后支持
6. 转人工

每条工作流包含：

- 触发意图
- 需要收集的字段
- 可调用知识库范围
- 允许动作
- 禁止动作
- 风险等级
- 转人工规则
- 结果状态

高风险工作流：

- 报价咨询
- 合同问题
- 售后故障
- 客户数据问题
- 合规承诺

这些场景必须支持人工接管。

## 11. 部署形态

### 11.1 SaaS 版

适合中小客户和标准官网客服场景。

特点：

- BeePilot 托管服务
- 多租户
- 快速开通
- 按会话量、坐席数、知识库容量计费

### 11.2 私有化版

适合金融、政务、央国企、大型制造等客户。

特点：

- 客户环境部署
- AI Provider 私有化或客户自有模型网关
- 自家 IM 私有化或客户自有 Conversation Channel
- 数据不出域
- 支持内网模型
- 支持信创适配

### 11.3 混合云版

适合部分数据敏感、部分能力可云端托管的客户。

特点：

- 客户知识库和会话数据本地
- 模型服务可选云端或本地
- 运维和升级更灵活

## 12. 分阶段 Roadmap

### Phase 0：产品定义与架构确认

目标：

- 确定 BeePilot 产品定位。
- 确定 BeePilot + BeeWorksAI + 自家 IM 的默认架构。
- 确定 AI Provider 与 Conversation Channel 均通过 Adapter 接入。
- 确定官网 Widget 自研。
- 确定一期 MVP 范围。

交付：

- 产品 Roadmap
- 技术架构
- 数据模型
- API 草案
- 当前官网原型
- 当前后台原型

状态：当前阶段。

### Phase 1：工程脚手架与基础平台

目标：

- 从静态原型进入正式工程。

交付：

- 前端应用：官网 Widget + Admin Console
- 后端服务：BeePilot API / Gateway
- 数据库：PostgreSQL
- ORM / migration
- 基础租户模型
- 基础会话模型
- 基础事件模型
- 环境配置
- Docker Compose 本地开发环境

验收：

- 本地能启动完整 BeePilot 服务。
- Admin Console 能读取真实 API。
- Widget 能创建真实会话。

### Phase 2：AI Provider 集成

目标：

- 打通 AI 回答能力。

交付：

- 租户级 AI Provider 配置
- Provider API Key 管理
- Gateway 调用统一 AI Provider 接口
- BeeWorksAI Provider 作为默认实现
- Dify / OpenAI / Customer API 作为可选实现
- 消息流式输出
- 来源引用
- AI Decision 字段回传
- 错误处理

验收：

- 用户在 Widget 提问后，AI 能基于已启用 Provider 返回回答。
- 回答记录保存到 BeePilot。
- 来源信息可展示。

### Phase 3：Conversation Channel 集成

目标：

- 打通自家 IM 会话通道、人工接管和 Agent Assist。

交付：

- Conversation Channel Adapter 接口
- 自家 IM Adapter 首个实现
- Visitor 映射 IM Contact / User
- Conversation 映射 IM Thread / Session
- 用户消息、AI 回答、人工消息同步到 BeePilot 会话主库
- 人工接管状态
- IM 跳转链接
- Agent Assist API：推荐回复、摘要、知识引用、下一步建议
- Chatwoot Adapter 作为后续可选实现

验收：

- 客服能在自家 IM 中看到官网 AI 会话上下文。
- 用户点击转人工后，自家 IM 中出现待处理会话。
- 坐席可从 IM 调用 BeePilot 获取 AI 建议。

### Phase 4：业务动作闭环

目标：

- 让 AI 不只是回答，还能推动业务。

交付：

- 线索创建
- 试用申请
- 报价申请
- 售后请求
- 表单字段收集
- 状态流转
- 企业微信/邮件通知
- CSV 导出

验收：

- 用户可从 AI 对话中完成留资、试用、报价和售后请求。
- Admin Console 可查看和处理业务请求。

### Phase 5：知识运营与回答优化

目标：

- 建立持续优化机制。

交付：

- 回答反馈
- 未命中问题
- 高频问题聚类
- 低质量回答列表
- FAQ 沉淀入口
- 知识缺口提醒
- 风险回答审计

验收：

- 运营人员能发现 AI 答不好的问题。
- 能将优秀回答沉淀为知识。
- 能追踪回答质量变化。

### Phase 6：多租户与产品化

目标：

- 从 BeeWorks 自用走向可销售产品。

交付：

- 多租户隔离
- Widget 嵌入代码
- 客户域名白名单
- 租户级 AI Provider / Conversation Channel 配置
- 计量与套餐
- 权限角色
- 审计日志

验收：

- 可以开通多个客户。
- 每个客户拥有独立 Widget、知识库、会话和数据。

### Phase 7：商业化增强

目标：

- 支撑 SaaS 与私有化交付。

交付：

- 订阅套餐
- 用量统计
- SLA 报表
- 私有化部署文档
- 监控告警
- 备份恢复
- 安全加固
- 信创适配规划

验收：

- 可作为正式产品销售和交付。

## 13. 第一阶段落地建议

立即进入 Phase 1。

建议工程栈：

- 前端：React + TypeScript + Vite
- 后端：Node.js + TypeScript + Fastify
- 数据库：PostgreSQL
- ORM：Prisma
- 队列：BullMQ + Redis
- 集成：AI Provider API、Conversation Channel Adapter
- 部署：Docker Compose 起步，后续 Kubernetes

Phase 1 最小任务：

1. 创建正式 mono repo。
2. 创建 Admin Console 应用。
3. 创建 Widget SDK 应用。
4. 创建 API / Gateway 服务。
5. 建立 PostgreSQL 数据模型。
6. 实现 conversation/message/visitor 基础 API。
7. 将当前静态原型迁移为 React 页面。
8. 保留 `site` 目录作为设计原型归档。

详细执行计划见：

- `docs/beepilot-phase1-implementation-plan.md`

## 14. 当前决策

已确定：

- 产品名：BeePilot
- 定位：企业 AI 客户互动平台
- 前台 Widget：自研
- AI 大脑：AI Provider 抽象层，BeeWorksAI 作为默认实现，Dify / OpenAI / Customer API 作为适配器
- 会话与人工接管：Conversation Channel Adapter，自家 IM 作为默认实现，Chatwoot 作为可选适配器
- 编排层：BeePilot AI Gateway + Policy Engine + Action Executor
- 数据主库：BeePilot 保留 AI 与人工会话、访客、线索、归因、事件和质检数据
- AI 决策边界：AI 可参与判断，BeePilot 负责策略校验、动作执行和审计
- 初始客户场景：BeeWorks 官网
- 长期方向：可独立销售给任意企业客户
