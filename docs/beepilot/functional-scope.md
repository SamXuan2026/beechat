# BeePilot 整体功能规划与功能清单

存档日期：2026-05-08

## 1. 产品定位

BeePilot 是企业 AI 客服与增长业务中台。

它不替代 BeeWorksAI / Dify，也不替代自家 IM / Chatwoot。BeePilot 的核心职责是把 AI 能力、会话通道、人工接待和业务转化动作统一编排，并沉淀为可分析、可运营、可审计的数据资产。

默认主线：

```text
BeePilot + BeeWorksAI + 自家 IM
```

可选适配：

```text
Dify / OpenAI / Customer API
Chatwoot / 企业微信 / 飞书 / Zendesk
```

## 2. 系统边界

### 2.1 BeePilot 负责

- 会话主库
- 访客身份管理
- AI 与人工消息归档
- AI Provider 配置和调用
- Conversation Channel 配置和适配
- AI 决策结果保存
- 业务策略执行
- 转人工流程
- 留资、报价、试用、售后请求
- 行为事件采集
- 渠道归因
- 会话质检
- 回答优化
- 线索评分
- 运营分析
- 多租户、权限、审计和商业化配置

### 2.2 BeeWorksAI / Dify 负责

- 知识库管理
- RAG 检索
- Prompt / Workflow
- Agent 编排
- 模型调用
- 流式生成
- AI 应用内部运行日志

### 2.3 自家 IM / Chatwoot 负责

- 消息触达
- 人工客服工作台
- 坐席接待
- 会话分配
- 内部协作
- 通知提醒
- 人工回复客户

### 2.4 关键原则

- IM 不直接调用 BeeWorksAI，只调用 BeePilot。
- BeePilot 统一调用 BeeWorksAI / Dify / OpenAI / Customer API。
- AI 可以参与业务判断，但 BeePilot 负责策略校验、动作执行和审计。
- BeePilot 不重造 Dify/BeeWorksAI 的 AI 应用编排能力。
- BeePilot 保留 AI 与人工会话数据主库。

## 3. 核心模块

### 3.1 Website Widget / Web Chat

前台访客入口。

功能清单：

- 官网嵌入式 AI 顾问
- 独立聊天页面
- 流式 AI 回复
- 快捷问题
- 留资入口
- 试用申请
- 报价咨询
- 售后请求
- 转人工入口
- 移动端适配
- 来源页面和归因采集
- 访客匿名 ID 生成和复用

### 3.2 Conversation Store

BeePilot 的会话主库。

功能清单：

- Visitor 管理
- Conversation 管理
- Message 管理
- AI 消息记录
- 人工消息记录
- 系统事件记录
- 会话状态：AI 接待、等待人工、人工处理中、已关闭
- 外部通道 ID 映射
- 外部 AI Provider ID 映射
- 会话详情页
- 消息时间线
- 访客资料视图
- 历史会话聚合

### 3.3 AI Provider Gateway

统一 AI 能力入口。

功能清单：

- BeeWorksAI Provider
- Dify Provider
- OpenAI Provider
- Customer API Provider
- Provider 配置页
- Base URL / API Key 管理
- Provider 启用切换
- 配置测试
- 流式响应代理
- AI 回复落库
- AI 调用元数据保存
- Provider 错误处理
- Provider 可替换架构

### 3.4 Policy Engine

把 AI 判断转化为可控业务动作。

功能清单：

- AI Decision schema
- 意图识别结果保存
- 置信度保存
- 风险等级保存
- 线索评分保存
- 推荐动作保存
- 策略阈值配置
- 是否自动回复客户
- 是否只给坐席建议
- 是否触发转人工
- 是否展示留资表单
- 是否创建报价请求
- 是否创建售后请求
- 高风险动作人工复核
- 动作执行审计

### 3.5 Action Executor

执行业务动作。

功能清单：

- 发送 AI 回复
- 展示留资卡片
- 展示报价卡片
- 展示试用卡片
- 创建客户请求
- 创建线索
- 创建售后请求
- 通知销售
- 通知客服
- 同步外部 IM 状态
- 同步 CRM / 工单系统
- 记录行为事件

### 3.6 Conversation Channel Adapter

统一人工通道和外部消息系统。

功能清单：

- 自家 IM Adapter
- Chatwoot Adapter
- 企业微信 Adapter
- 飞书 Adapter
- Zendesk Adapter
- 创建外部联系人
- 创建外部会话
- 同步用户消息
- 同步 AI 消息
- 同步人工消息
- 同步会话状态
- 获取外部会话跳转链接
- Webhook 接收人工回复
- Webhook 接收状态变更

### 3.7 Human Handoff

人工接管。

功能清单：

- 用户主动转人工
- AI 建议转人工
- 规则强制转人工
- 售后转人工
- 报价转销售
- 创建人工会话
- 同步会话摘要
- 同步最近消息
- 同步访客资料
- 分配队列或坐席
- 接管状态追踪
- 关闭会话

### 3.8 Agent Assist

人工客服 AI 辅助。

功能清单：

- 推荐回复
- 会话摘要
- 知识库引用
- 下一步动作建议
- 用户意图
- 风险提醒
- 售后 SOP
- 报价流程提示
- 试用流程提示
- 坐席采纳记录
- 坐席反馈记录

调用关系：

```text
IM 工作台 → BeePilot Agent Assist API → BeeWorksAI / Dify
```

### 3.9 Lead & Request Center

线索和请求中心。

功能清单：

- 产品咨询
- 试用申请
- 报价咨询
- 售后支持
- 转人工请求
- 联系人信息
- 公司信息
- 需求描述
- 请求状态
- 跟进记录
- 销售分配
- 客服分配
- CRM 同步
- CSV 导出

### 3.10 Analytics & Attribution

增长分析和运营分析。

功能清单：

- 页面来源
- referrer
- UTM
- gclid
- bd_vid
- AI 打开率
- 首问率
- 消息数
- 解决率
- 转人工率
- 留资率
- 报价率
- 试用率
- 售后自助解决率
- 渠道转化
- 会话质量
- 知识缺口

### 3.11 Answer Optimization

回答优化闭环。

功能清单：

- 用户反馈
- 坐席反馈
- 错误回答标记
- 低质量回答列表
- 未命中问题
- 高频问题聚类
- 知识缺口
- 建议补充知识
- 优秀回答沉淀
- 风险回答审计
- AI 决策回放

### 3.12 Admin Console

BeePilot 管理后台。

功能清单：

- 总览指标
- 会话列表
- 会话详情
- 访客详情
- 客户请求列表
- Provider 配置
- Channel 配置
- 策略配置
- Agent Assist 记录
- 回答质检
- 数据分析
- 租户配置
- 权限角色
- 审计日志

## 4. 数据对象清单

核心对象：

- Tenant
- Widget
- Visitor
- Conversation
- Message
- Event
- AiProviderConfig
- ChannelConfig
- CustomerRequest
- Lead
- HandoffEvent
- AgentAssistSuggestion
- ConversationSummary
- AnswerFeedback
- PolicyRule
- ActionLog
- AuditLog

## 5. 阶段规划

### Phase 1：当前基础闭环

目标：官网 Widget + BeeWorksAI + BeePilot 会话主库跑通。

已具备或正在补齐：

- Widget 创建会话
- Widget 发送消息
- BeeWorksAI Provider
- 流式回复
- 消息落库
- Provider 配置
- 客户请求
- 会话列表
- 会话详情
- 基础文档边界

### Phase 2：会话运营视图

目标：让 BeePilot 成为可运营的会话主库。

功能：

- 完整会话详情页
- 访客详情页
- 历史会话聚合
- 消息 Provider 元数据
- 来源归因展示
- 留资请求关联
- 会话搜索和筛选

### Phase 3：自家 IM Channel

目标：接入自家 IM，实现人工接管。

功能：

- Conversation Channel Adapter 接口
- 自家 IM Adapter
- 转人工
- IM 会话创建
- 人工消息同步回 BeePilot
- BeePilot 会话状态同步
- IM 跳转链接

### Phase 4：Agent Assist

目标：人工客服可从 BeePilot 获取 AI 辅助。

功能：

- 推荐回复 API
- 会话摘要 API
- 知识引用 API
- 下一步动作建议
- 坐席采纳/反馈

### Phase 5：Policy Engine + Action Executor

目标：让 AI 判断变成可控业务动作。

功能：

- AI Decision schema
- 业务策略配置
- 线索评分
- 自动展示表单
- 自动通知销售/客服
- 高风险人工复核
- 动作审计

### Phase 6：分析与优化

目标：建立 AI 客服和增长运营闭环。

功能：

- 渠道归因
- 转化漏斗
- 会话质量
- 回答质量
- 知识缺口
- 坐席辅助效果
- 线索转化分析

### Phase 7：产品化与商业化

目标：可交付给外部客户。

功能：

- 多租户
- 权限角色
- 用量统计
- 套餐计费
- 审计日志
- 私有化部署
- 监控告警
- 数据备份

## 6. 下一步优先级

当前最优先：

1. 完成会话详情页，确认 BeePilot 会话主库可运营。
2. 梳理自家 IM Adapter 需要的 API 能力。
3. 设计 Conversation Channel Adapter 接口。
4. 设计 Agent Assist API。
5. 设计 AI Decision schema 和 Policy Rule 最小版本。
