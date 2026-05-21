# BeeChat 前端工程化改造方案

## 一、改造目标

BeeChat 早期前端采用原生 HTML、CSS、JavaScript 实现，适合 MVP 快速验证，但后续继续扩展管理后台、设置页、复杂消息交互、审计详情和企业集成时，维护成本会快速升高。

本阶段目标是将前端迁移为组件化、类型化、可测试、可持续迭代的企业级前端工程。

核心目标：

- 保持当前 MVP 功能不回退。
- 保持现有设计风格与 Pencil 设计稿一致。
- 支持后续管理后台、设置页、审计详情等页面扩展。
- 建立统一 API Client、类型定义、设计令牌和组件边界。
- 为后续引入自动化页面测试打基础。

## 二、当前技术栈

当前已落地：

```text
Vite
React
TypeScript
原生 CSS + 设计令牌
原生 Fetch API
组件内状态编排
```

推荐原因：

- React 生态成熟，适合复杂交互型工作台。
- TypeScript 可约束消息、频道、用户、审计等数据结构。
- Vite 构建轻量，适合当前 MVP 平滑迁移。
- CSS Modules 可避免样式污染，迁移成本低于引入大型 UI 框架。
- 当前项目无复杂依赖，先保持轻量，避免过早引入重型状态库。

## 三、目录结构

当前已新增 `frontend/`，后端入口已优先托管 `frontend/dist`，旧 `web/` 作为回退目录保留。

```text
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── api/
    │   ├── client.ts
    │   ├── auth.ts
    │   ├── channels.ts
    │   ├── messages.ts
    │   ├── files.ts
    │   ├── audits.ts
    │   └── members.ts
    ├── components/
    │   ├── Avatar/
    │   ├── Badge/
    │   ├── Button/
    │   ├── EmptyState/
    │   ├── Modal/
    │   ├── PanelTabs/
    │   └── TextInput/
    ├── features/
    │   ├── auth/
    │   ├── chat/
    │   │   ├── ChatWorkspace.tsx
    │   │   └── components/
    │   └── settings/
    ├── styles/
    │   ├── tokens.css
    │   ├── global.css
    │   └── reset.css
    ├── types/
    │   ├── api.ts
    │   ├── auth.ts
    │   ├── chat.ts
    │   └── audit.ts
    └── utils/
        ├── format.ts
        ├── escape.ts
        └── storage.ts
```

## 四、组件拆分

### 页面级组件

```text
LoginPage
ChatWorkspace
SettingsPage
AdminPage
```

### 布局组件

```text
ChatSidebar
MessageList
MessageComposer
RightPanel
ThreadPanel
MemberPanel
AuditPanel
DiscoverChannelsModal
```

### 业务组件

```text
ChannelList
DirectMessageList
MessageList
MessageItem
MessageComposer
ThreadPanel
AuditPanel
MemberPanel
DiscoverChannelsModal
SearchResults
FileCard
```

### 通用组件

```text
Avatar
Badge
Button
TextInput
Modal
PanelTabs
EmptyState
LoadingState
```

## 五、类型模型

核心类型：

```text
User
Session
Workspace
Channel
Message
MessageFile
AuditLog
ChannelMember
MessagePage
RealtimeEvent
```

类型要求：

- API 返回值必须有明确类型。
- 消息类型区分频道消息与私信消息。
- 文件消息必须保留原始文件名、大小、下载路径。
- 审计日志必须包含操作类型、操作者、目标、时间。

## 六、API Client 设计

统一入口：

```text
src/api/client.ts
```

职责：

- 统一 base URL。
- 注入 token。
- 处理 JSON 请求。
- 处理 FormData 上传。
- 统一错误结构。
- 处理未登录状态。

模块划分：

```text
authApi.login()
authApi.session()
channelApi.list()
channelApi.create()
channelApi.join()
messageApi.listChannelMessages()
messageApi.sendChannelMessage()
messageApi.updateMessage()
messageApi.revokeMessage()
fileApi.upload()
auditApi.list()
memberApi.list()
memberApi.invite()
memberApi.remove()
```

## 七、状态管理

第一阶段不建议引入复杂状态库，优先使用 React 内置能力：

```text
useReducer
useContext
自定义 hooks
```

建议拆分：

```text
AuthContext
WorkspaceContext
RealtimeContext
```

后续如状态复杂度升高，再评估：

```text
Zustand
Redux Toolkit
```

## 八、设计令牌落地

设计令牌来自：

```text
design/beechat/DESIGN_SPEC.md
```

落地文件：

```text
frontend/src/styles/tokens.css
```

建议变量：

```css
:root {
  --color-sidebar: #281850;
  --color-sidebar-active: #5a3a9e;
  --color-page: #f3f5f9;
  --color-surface: #ffffff;
  --color-input: #f6f7fa;
  --color-primary: #4a9fd8;
  --color-success: #41c585;
  --color-warning: #f5a623;
  --color-danger: #e05252;
  --color-text: #1f2937;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9aa3b2;
  --color-border: #e6eaf2;

  --radius-button: 6px;
  --radius-input: 6px;
  --radius-bubble: 8px;
  --radius-card: 8px;
  --radius-panel: 10px;

  --sidebar-width: 232px;
  --right-panel-width: 320px;
  --topbar-height: 56px;
}
```

## 九、迁移策略

### 原则

- 保留现有 `web/` 作为回退入口。
- 新建 `frontend/` 并逐步替换。
- 后端 API 不先大改。
- 新前端完成等价能力后再切换静态资源输出。

### 步骤

1. 新建 `frontend/` 工程。已完成。
2. 建立设计令牌和全局样式。已完成。
3. 封装 API Client。已完成。
4. 实现登录页。已完成。
5. 实现主工作台布局。已完成。
6. 接入频道、私信、消息列表。已完成。
7. 接入发送消息。已完成。
8. 接入线程面板。已完成。
9. 接入审计与成员面板。已完成。
10. 接入发现频道弹层。已完成。
11. 接入文件上传。已完成。
12. 固化一屏布局约束。已完成。
13. 拆分 `ChatWorkspace` 展示组件。已完成。
14. 接入 WebSocket 实时刷新。已完成。
15. 完善设置页第一期。已完成。
16. 完善管理后台。待推进。

## 十、后端配合改造

当前后端直接托管 `web/` 静态目录。工程化后建议：

```text
开发环境：Vite dev server 代理 /api
生产环境：后端托管 frontend/dist
```

后端需支持：

- 静态目录可配置。
- `/api/*` 与前端路由区分。
- 生产构建产物部署说明。

## 十一、测试与验收

### 必须保留

```text
npm run smoke
```

### 建议新增

```text
frontend npm run build
frontend npm run lint
frontend npm run typecheck
frontend npm run smoke
```

### 页面验收

- 登录页可登录。
- 主聊天页可加载频道与消息。
- 可发送、编辑、撤回消息。
- 可加载更早消息。
- 可打开线程并回复。
- 可上传文件。
- 可搜索消息。
- 可打开发现频道并加入频道。
- 可查看审计和成员。

## 十二、风险与控制

| 风险 | 影响 | 控制方式 |
| --- | --- | --- |
| 一次性重写导致 MVP 不可用 | 阻断演示 | 新建 `frontend/` 并行迁移 |
| 组件拆分过度 | 开发速度下降 | 先拆页面与核心业务组件 |
| 状态管理复杂 | Bug 增加 | 先用 Context + Reducer |
| UI 与 Pencil 偏差 | 体验不一致 | 引入设计令牌并做截图验收 |
| API 类型不稳定 | 前端返工 | 先固化 `types/api.ts` |

## 十三、阶段交付物

第一批交付：

```text
frontend/ 基础工程
tokens.css
API Client
类型定义
LoginPage
ChatShell 静态布局
```

第二批交付：

```text
频道列表
私信列表
消息列表
发送消息
分页
```

第三批交付：

```text
线程面板
审计面板
成员面板
发现频道
文件上传
WebSocket
```

第四批交付：

```text
构建部署
冒烟验证
视觉验收
替换旧 web 静态入口
```

## 十四、当前进展与建议

当前前端工程化主体已完成：

1. 已新增 `frontend/` 工程骨架、设计令牌、类型定义、API Client、基础组件、登录页与主工作台。
2. 已接入真实登录、会话恢复、频道切换、消息列表、发送消息、线程回复、发现频道、成员管理、审计面板、文件上传。
3. 已将后端入口切换为优先托管 `frontend/dist`，旧 `web/` 保留回退。
4. 已补充 Playwright 回归脚本，覆盖登录、消息、线程、频道、成员、审计、文件上传和一屏布局。
5. 已拆分 `ChatWorkspace` 展示组件，当前容器保留状态编排和接口调用。
6. 已拆分 `RightPanel` 内部面板，线程、成员、审计面板具备独立演进边界。
7. 已接入 React 前端 WebSocket 实时刷新，支持频道消息、线程消息、文件上传、消息编辑/撤回、成员变更和频道创建事件。
8. 已增强快速冒烟脚本，校验 `message:channel` 实时事件确实推送到客户端。
9. 已实现设置页第一期，支持个人资料、通知偏好、快捷键展示、退出登录入口，并通过 `/api/settings` 持久化。
10. 已补充登录页测试账号快捷登录按钮，便于验收和体验测试。
11. 已完成阶段 4 第二期管理后台能力，支持角色维护、安全策略保存、审计导出入口。

下一步建议：

1. 补充组件级单元测试或轻量交互测试。
2. 评估 PostgreSQL、Redis 与对象存储迁移方案。
3. 设计 IP 白名单与文件上传策略。
4. 准备阶段 5 消息增强方案。
