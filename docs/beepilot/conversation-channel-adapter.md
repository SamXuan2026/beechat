# Conversation Channel Adapter 设计草案

存档日期：2026-05-08

## 1. 目标

Conversation Channel Adapter 用于把 BeePilot 的会话业务主库连接到外部沟通通道。

默认目标通道是自家 IM。Chatwoot、企业微信、飞书、Zendesk 等都作为同一接口下的可选适配器。

核心原则：

- BeePilot 是会话主库。
- Channel 是消息触达和人工工作台。
- Channel 不直接调用 BeeWorksAI。
- Channel 如需 AI 自动回复、坐席建议、摘要、知识引用，统一调用 BeePilot。
- BeePilot 通过 Adapter 调用 Channel，不依赖具体通道内部模型。

## 2. 通道类型

一期预留：

- `workplus_im`：自家 IM，默认通道。
- `chatwoot`：开源客服工作台，可选适配器。
- `wechat_work`：企业微信。
- `feishu`：飞书。
- `zendesk`：外部客服系统。
- `disabled`：未启用。

## 3. 标准对象映射

### 3.1 Contact

BeePilot:

- `Visitor`

Channel:

- IM User / External Contact
- Chatwoot Contact
- 企业微信外部联系人
- 飞书用户

最小映射：

- `visitor.id`
- `visitor.anonymous_id`
- `name`
- `company`
- `phone`
- `email`
- `external_contact_id`
- `external_user_id`

### 3.2 Conversation

BeePilot:

- `Conversation`

Channel:

- IM Thread / Session
- Chatwoot Conversation
- 企业微信会话
- 飞书会话

最小映射：

- `conversation.id`
- `external_conversation_id`
- `external_thread_id`
- `external_url`
- `status`
- `assignee`
- `team`

### 3.3 Message

BeePilot:

- `Message`

Channel:

- IM Message
- Chatwoot Message
- 企业微信消息
- 飞书消息

最小映射：

- `message.id`
- `role`
- `content`
- `attachments`
- `external_message_id`
- `created_at`

## 4. Adapter 接口

代码位置：

```text
apps/api/src/integrations/conversation-channel/
```

核心接口：

```ts
interface ConversationChannelAdapter {
  readonly type: ConversationChannelType
  upsertContact(input): Promise<ChannelContactRef>
  createConversation(input): Promise<ChannelConversationRef>
  sendMessage(input): Promise<ChannelMessageRef>
  assignConversation(input): Promise<void>
  updateConversationStatus(input): Promise<void>
}
```

## 5. 典型流程

### 5.1 AI 自动接待

```text
用户发消息
  ↓
BeePilot 保存 visitor message
  ↓
BeePilot 调 BeeWorksAI
  ↓
BeePilot 保存 assistant message
  ↓
如当前通道需要同步，则通过 Adapter sendMessage
```

### 5.2 转人工

```text
用户点击转人工 / AI 建议转人工 / 策略强制转人工
  ↓
BeePilot 创建 HandoffEvent
  ↓
Adapter upsertContact
  ↓
Adapter createConversation
  ↓
Adapter sendMessage 同步接管摘要和最近消息
  ↓
BeePilot 更新 conversation 状态为 pending_handoff
```

### 5.3 人工回复同步

```text
坐席在 IM 回复
  ↓
IM Webhook 推给 BeePilot
  ↓
BeePilot 保存 agent message
  ↓
BeePilot 更新会话状态 / 统计 / 质检数据
```

### 5.4 Agent Assist

```text
坐席在 IM 点击 AI 建议
  ↓
IM 调 BeePilot Agent Assist API
  ↓
BeePilot 读取标准会话上下文
  ↓
BeePilot 调 BeeWorksAI / Dify
  ↓
BeePilot 返回推荐回复、摘要、知识引用、下一步动作
  ↓
IM 展示给坐席，不直接发送给客户
```

## 6. 自家 IM 首期需要确认的 API

最小必需：

- 创建或查找外部联系人。
- 创建会话/thread/session。
- 发送文本消息。
- 接收用户消息 webhook。
- 接收坐席消息 webhook。
- 更新会话状态。
- 获取会话跳转链接。

增强能力：

- 分配坐席。
- 分配队列。
- 内部备注。
- 附件消息。
- 已读状态。
- 坐席在线状态。
- 会话关闭和重开。

## 7. 数据库后续建议

后续需要新增：

- `channel_configs`
- `channel_contacts`
- `channel_conversations`
- `channel_messages`
- `handoff_events`
- `agent_assist_suggestions`

Phase 2 可以先只做接口草案，不急着建全量表。Phase 3 接自家 IM 时再按真实 API 建 migration。
