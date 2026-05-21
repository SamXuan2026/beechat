# BeeChat 设计文档

## 一、设计来源

原 BeeChat Pencil 多画板源文件已丢失。当前设计已基于历史截图、现有 MVP 功能与重建设计规范重新整理。

正式设计源文件：

```text
design/beechat/beechat-main-chat.pen
```

设计规范：

```text
design/beechat/DESIGN_SPEC.md
```

旧占位文件：

```text
design/beechat/beechat-main-chat.placeholder-old.pen
```

旧占位文件内容仍是“多模型智能聊天工作台”，不可作为 BeeChat 设计依据。

## 二、设计原则

- 企业后台风格：克制、清晰、稳定，优先信息效率。
- 私有化协同：突出内网审计、消息留痕、文件脱敏。
- 低学习成本：沿用频道、私信、线程、搜索等常见协作范式。
- 高可迭代性：界面拆分为主工作台、线程、登录、发现频道、设置五类画板。

## 三、信息架构

```text
BeeChat
├── 登录页
├── 主聊天工作台
│   ├── 左侧导航
│   │   ├── 品牌与安全模式
│   │   ├── 全局搜索
│   │   ├── 频道列表
│   │   ├── 发现频道
│   │   ├── 私信列表
│   │   └── 当前用户
│   ├── 中央消息区
│   │   ├── 频道头部
│   │   ├── 安全提示
│   │   ├── 消息列表
│   │   └── 输入区
│   └── 右侧面板
│       ├── 线程
│       ├── 审计
│       └── 成员
├── 发现频道
└── 设置页
```

## 四、核心画板

| 画板 | 用途 | 当前状态 |
| --- | --- | --- |
| BeeChat - Main | 主聊天工作台 | 已重建 |
| BeeChat - Thread View | 线程视图 | 已重建 |
| BeeChat - Login | 登录页 | 已重建 |
| BeeChat - Discover Channels | 发现频道 | 已重建 |
| BeeChat - Settings | 设置页 | 已重建 |

## 五、前端实现映射

| 设计区域 | 前端文件 | 实现说明 |
| --- | --- | --- |
| 登录页 | `frontend/src/features/auth/LoginPage.tsx`、`LoginPage.css` | 登录卡片、测试账号快捷登录、账号密码、错误提示 |
| 工作台容器 | `frontend/src/features/chat/ChatWorkspace.tsx` | 状态编排、数据刷新、实时事件、业务操作分发 |
| 工作台 Hooks | `frontend/src/features/chat/hooks/` | 搜索、草稿、线程、发现频道、设置、管理后台状态收敛 |
| 左侧导航 | `frontend/src/features/chat/components/ChatSidebar.tsx` | 品牌、全局搜索、搜索类型标签、频道、私信、发现频道入口、当前用户 |
| 左侧导航样式 | `frontend/src/features/chat/components/ChatSidebar.css` | 渐变侧栏、品牌卡片、当前频道高亮条、搜索结果类型色条、频道、私信、未读徽标、当前用户卡片 |
| 主聊天区 | `frontend/src/features/chat/components/ChatMainPanel.tsx` | 频道头部、频道图标、安全协作信息条、频道公告、置顶摘要、消息列表、输入区壳层 |
| 主聊天区样式 | `frontend/src/features/chat/components/ChatMainPanel.css` | 频道头部、频道图标、安全协作信息条、频道公告、置顶摘要 |
| 消息列表 | `frontend/src/features/chat/components/MessageList.tsx` | 消息渲染、发送者归属、文件卡片、图片预览、置顶、收藏、回应、搜索高亮 |
| 消息列表样式 | `frontend/src/features/chat/components/MessageList.css` | 背景层次、日期胶囊、消息气泡、自己消息蓝色渐变、他人消息白色卡片、文件卡片、反应区、消息错误态 |
| 输入区 | `frontend/src/features/chat/components/MessageComposer.tsx` | 文本输入、发送、上传、`@` 人快捷入口、草稿状态、发送状态辅助文本 |
| 输入区样式 | `frontend/src/features/chat/components/MessageComposer.css` | 工具栏、输入框、发送区、固定尺寸工具按钮、`@` 人快捷入口、输入区错误态 |
| 窄屏工作台 | `frontend/src/features/chat/ChatWorkspace.css` | 动态侧栏高度、主区剩余视口、移动端一屏布局 |
| 弹层基础样式 | `frontend/src/components/Modal/Modal.css` | 桌面居中弹层、窄屏近全屏弹层 |
| 右侧面板 | `frontend/src/features/chat/components/RightPanel.tsx` | 线程、文件、审计、成员 Tab 壳层 |
| 右侧面板样式 | `frontend/src/features/chat/components/RightPanel.css` | 右侧面板壳层、分段 Tab、统一面板头、线程、成员、文件、审计卡片 |
| 线程面板 | `frontend/src/features/chat/components/ThreadPanel.tsx` | 面板头、线程根消息、回复列表、线程回复输入 |
| 审计面板 | `frontend/src/features/chat/components/AuditPanel.tsx` | 面板头、审计过滤、审计列表、加载态、错误态 |
| 成员面板 | `frontend/src/features/chat/components/MemberPanel.tsx` | 面板头、成员列表、邀请、移除、加载态、错误态 |
| 文件面板 | `frontend/src/features/chat/components/FilePanel.tsx` | 面板头、频道文件列表、图片文件区分、空状态 |
| 发现频道 | `frontend/src/features/chat/components/DiscoverChannelsModal.tsx` | 弹层、搜索、创建频道、加入频道 |
| 发现频道样式 | `frontend/src/features/chat/components/DiscoverChannelsModal.css` | 创建表单、频道列表、频道卡片 |
| 设置页 | `frontend/src/features/chat/components/SettingsModal.tsx` | 个人资料、通知偏好、快捷键展示 |
| 设置页样式 | `frontend/src/features/chat/components/SettingsModal.css` | 个人资料、偏好开关、快捷键、操作区 |
| 管理后台 | `frontend/src/features/chat/components/AdminModal.tsx` | 用户角色、频道说明、审计、安全策略、文件策略、网络策略 |
| 管理后台样式 | `frontend/src/features/chat/components/AdminModal.css` | 摘要、指标、用户、频道、审计、策略区 |

## 六、视觉规范

主色：

```text
侧边栏背景   #281850
高亮紫       #5A3A9E
主按钮蓝     #4A9FD8
成功绿       #41C585
警告橙       #F5A623
错误红       #E05252
页面背景     #F3F5F9
内容背景     #FFFFFF
边框         #E6EAF2
```

尺寸：

```text
左侧导航宽度     232px
右侧面板宽度     320px
顶部栏高度       56px
登录卡片宽度     360px
发现频道弹层宽度 720px
```

圆角：

```text
按钮       6px
输入框     6px
消息气泡   8px
卡片       8px
登录卡片   10px
```

## 七、交互说明

### 发现频道

- 点击左侧“发现频道”打开弹层。
- 输入关键词过滤频道名称与描述。
- 已加入频道按钮置灰并显示“已加入”。
- 未加入频道点击“加入”后切换当前频道并关闭弹层。

### 线程

- 点击消息操作区的“线程”打开右侧线程面板。
- 线程面板展示根消息、回复列表、审计提示、回复输入框。
- 私信模式不展示线程入口。

### 审计

- 审计面板支持全部、消息、文件、成员、登录过滤。
- 敏感词消息在消息区展示提示。
- 关键操作进入审计记录。

### 侧边栏与搜索

- 频道与私信统一使用紧凑导航条目，长名称自动省略。
- 频道未读、`@我`、私信未读统一使用徽标样式。
- 搜索结果提供加载态、空状态、错误态和结果数量。
- 搜索结果区域独立滚动，不能挤压当前用户区或撑破主界面。

### 消息区与输入区状态

- 消息列表的加载失败保留在消息流区域，并提供重试动作。
- 发送失败、上传失败固定展示在输入区上方，避免与消息读取错误混淆。
- 发送按钮在空内容、发送中、上传中状态下禁用。
- 输入区使用“待输入”“上传中”“草稿已保存”等弱提示说明当前状态，不抢占消息阅读区。

### 成员

- 管理员可邀请、移除频道成员。
- 普通用户不展示管理操作。

### 管理后台

- 管理后台顶部展示摘要区，突出当前控制台用途和审计导出主操作。
- 用户、策略、频道、审计按独立区块排列，避免表单堆叠。
- 安全策略、文件策略、网络策略在桌面端使用策略网格，窄屏自动单列。
- 审计详情保留最近记录数量，导出入口在顶部保持稳定可见。

### 窄屏适配

- 窄屏下左侧栏改为顶部区域并支持内部滚动。
- 窄屏下右侧面板隐藏，避免主消息区被压扁。
- 输入区始终保持在主消息区底部。
- 弹层在窄屏下接近全屏展示，内部滚动，避免内容被裁切。

## 八、设计验收

- Pencil 文件可打开，顶层画板数量为 5。
- 前端主界面与 Pencil 主画板布局一致。
- 登录页、发现频道、线程面板视觉风格一致。
- 动态文本渲染前进行 HTML 转义。
- 窄屏下右侧线程面板隐藏，主流程仍可操作。
- 阶段 6.5 无头 E2E 验收 14 个用例全部通过。
