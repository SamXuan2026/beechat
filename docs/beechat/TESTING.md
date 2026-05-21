# BeeChat 测试说明与报告索引

## 一、测试目标

BeeChat 测试体系分为开发期快速回归和阶段验收回归。

开发期默认执行快速回归，确保每次功能增量不破坏核心链路。

阶段验收或明确要求查看浏览器过程时，执行 Playwright 可视化 E2E。

## 二、测试分层

| 层级 | 命令 | 场景 | 说明 |
| --- | --- | --- | --- |
| 静态检查 | `node --check` | 脚本语法 | 检查 Node 脚本语法 |
| 类型检查 | `npm --prefix frontend run typecheck` | 前端开发 | 检查 TypeScript 类型 |
| 前端构建 | `npm --prefix frontend run build` | 前端开发 | 生成 `frontend/dist` |
| API 冒烟 | `npm run smoke` | 快速回归 | 检查入口、登录、消息、文件、审计、实时事件、健康检查、运行指标、结构化日志等主链路 |
| 无头 E2E | `npm run e2e` | 阶段验收 | 使用 Playwright Chromium 无头执行 |
| 可视化 E2E | `npm run e2e:headed` | 阶段验收 | 打开浏览器展示测试过程 |

## 三、快速回归命令

```bash
node --check playwright.config.js
node --check server/index.js
node --check server/repositories/contracts.js
node --check server/repositories/sqlite-repository.js
node --check server/repositories/postgres-repository.js
node --check scripts/check-repository-contract.js
node --check scripts/smoke.js
node --check tests/e2e/beechat.regression.spec.js
npm run db:repository:check
npm run db:adapter:check
npm run db:runtime:check
npm run db:plan:check
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm run docs:build
npm run smoke
git diff --check
```

## 四、Playwright E2E 命令

首次运行前安装依赖：

```bash
npm install
npx playwright install chromium
```

无头回归：

```bash
npm run e2e
```

可视化回归：

```bash
npm run e2e:headed
```

慢动作可视化回归：

```bash
E2E_SLOWMO=500 npm run e2e:headed
```

## 五、当前 E2E 用例

测试文件：

```text
tests/e2e/beechat.regression.spec.js
```

当前用例：

| 用例 | 覆盖内容 |
| --- | --- |
| 入口页面可加载并展示登录页 | 根路径访问、登录页展示 |
| 测试账号可快捷登录 | 登录页测试账号按钮、普通成员快捷登录 |
| 主体界面固定在一个屏幕内 | 桌面与窄屏视口下校验页面、应用壳层、主区、侧栏、输入区不超过浏览器高度 |
| 长文本、输入区与右侧面板不会撑破主界面 | 长文本自动换行、输入区固定在视口内、成员/文件/审计面板切换后仍可见 |
| 侧边栏搜索、频道未读和私信状态保持稳定 | 频道 `@我` 标识、私信项、搜索空状态、搜索结果和侧边栏高度约束 |
| 窄屏下侧栏、输入区和管理弹层保持可操作 | 移动视口、右侧面板隐藏、侧栏搜索、输入区、管理后台弹层不溢出 |
| 管理员可登录、发送频道消息、发送线程回复并退出 | 登录、频道消息、线程回复、退出 |
| 管理员可在发现频道中创建频道并发送消息 | 发现频道、创建频道、新频道消息 |
| 管理员可在成员面板邀请并移除频道成员 | 成员面板、邀请成员、移除成员 |
| 管理员可在审计面板按类型筛选记录 | 审计面板、登录筛选、成员筛选 |
| 管理员可在审计面板组合筛选记录 | 审计操作者、关键词组合筛选 |
| 管理员可打开设置并保存个人偏好 | 设置弹层、个人简介、偏好保存 |
| 管理员可打开管理后台并维护频道说明 | 管理入口、管理弹层、摘要区、策略区、审计详情、频道说明保存 |
| 管理员可维护角色、安全策略并看到审计导出入口 | 角色切换、安全策略保存、审计 CSV 导出入口 |
| 审计员可查看与导出审计 | 审计员角色、审计读取、CSV 导出、禁止访问管理总览 |
| 频道管理员可维护频道 | 频道管理员角色、频道说明维护、邀请成员、移除成员、禁止访问管理总览 |
| 管理员可维护文件上传策略 | 文件大小、允许扩展名策略保存 |
| 管理员可维护网络策略 | IP 白名单保存、本机白名单访问验证 |
| 管理员可上传频道文件并看到文件卡片 | 文件上传、文件消息卡片 |
| 阶段 5 协作增强快速回归 | 频道公告、置顶、收藏、表情回应、图片预览、频道文件列表、@ 人提醒、草稿、搜索定位、在线状态、相关审计 |

## 六、测试报告位置

Playwright 原生 HTML 报告：

```text
playwright-report/index.html
```

Playwright 运行结果：

```text
test-results/
```

说明：

- `playwright-report/` 是测试运行产物，已加入 `.gitignore`。
- `test-results/` 是测试运行产物，已加入 `.gitignore`。
- 正式可归档测试说明是本文档，对应 HTML 输出为 `docs/beechat/TESTING.html`。
- 开发期冒烟 HTML 报告为 `docs/beechat/SMOKE_REPORT.html`。

## 七、文档样式

HTML 文档使用本地 Tailwind CSS 构建，支持离线浏览，不依赖 CDN。

```text
tailwind.docs.config.js
docs/assets/docs.tailwind.css
docs/assets/docs.css
```

## 八、最近一次结果

测试时间：

```text
2026-05-19 Asia/Shanghai
```

测试范围：

```text
阶段 6.5 主聊天体验打磨第一期快速回归
```

最近一次无头 E2E 阶段验收已通过：

```text
14 passed (21.2s)
```

最近一次开发期快速回归已通过：

```text
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm run db:plan:check
npm run db:runtime:check
npm run db:adapter:check
npm run db:repository:check
npm run db:export:postgres
npm run docs:build
npm run smoke
node --check server/index.js
node --check server/repositories/contracts.js
node --check server/repositories/sqlite-repository.js
node --check server/repositories/postgres-repository.js
node --check scripts/smoke.js
node --check scripts/check-postgres-plan.js
node --check scripts/check-postgres-adapter.js
node --check scripts/check-repository-contract.js
node --check tests/e2e/beechat.regression.spec.js
```

阶段 6 第十六期新增快速回归覆盖：

```text
频道公告读取与维护
频道管理员维护频道公告
管理员维护频道公告
消息置顶
取消消息置顶
置顶消息审计记录
收藏消息
取消收藏消息
表情回应
取消表情回应
收藏与回应审计记录
图片文件上传
频道文件列表读取
文件列表包含图片文件
@ 人提醒识别
提及未读计数
本地草稿保存与发送后清理由前端输入区实现
搜索结果返回频道上下文
搜索结果可用于前端频道定位与目标消息高亮
用户登录后动态在线
用户退出后会话失效
用户退出后在线状态释放
实时在线状态事件类型已接入前端
健康检查返回启动时间与运行时长
运行指标接口返回进程、内存、会话、实时连接、数据大小与业务计数
本地备份脚本完成语法检查
结构化日志文件生成
HTTP 请求结构化日志写入
运行指标返回日志大小
Docker 多阶段构建配置检查
生产 Compose 数据卷、日志卷、备份卷配置检查
生产环境变量样例检查
Nginx WebSocket 反向代理样例检查
PostgreSQL 表结构迁移检查
PostgreSQL 生产数据库环境变量检查
SQLite 到 PostgreSQL 迁移规划检查
PostgreSQL 一次性导入 SQL 生成
PostgreSQL 导入 SQL 基础内容校验
数据库运行模式配置保护
PostgreSQL 缺少连接串启动失败校验
PostgreSQL 适配层未启用启动失败校验
健康检查数据库运行摘要
PostgreSQL 查询适配层接口检查
PostgreSQL 连接串校验
PostgreSQL 事务封装检查
PostgreSQL 迁移执行封装检查
业务仓储契约方法清单检查
SQLite 仓储骨架检查
PostgreSQL 仓储骨架检查
双实现契约一致性检查
主服务初始化 SQLite 仓储
频道读取路径接入仓储
成员列表读取路径接入仓储
频道文件列表读取路径接入仓储
频道消息接口访问权限判断接入仓储
频道消息分页读取接入仓储
PostgreSQL 仓储频道消息分页查询
私信分页读取接入仓储
PostgreSQL 仓储私信分页查询
审计查询读取接入仓储
审计导出读取接入仓储
PostgreSQL 仓储审计筛选查询
PostgreSQL 仓储频道文件列表查询
频道消息发送写入接入 SQLite 仓储
线程回复发送写入接入 SQLite 仓储
主服务频道消息发送写入路径接入仓储
私信发送写入接入 SQLite 仓储
主服务私信发送写入路径接入仓储
PostgreSQL 频道消息与私信写入仓储显式未启用保护
消息编辑写入接入 SQLite 仓储
消息撤回写入接入 SQLite 仓储
主服务消息编辑写入路径接入仓储
主服务消息撤回写入路径接入仓储
PostgreSQL 消息编辑与消息撤回写入仓储显式未启用保护
文件上传发送写入链路暂保留原实现
冒烟 HTML 报告生成
```

阶段 6.5 第一期新增快速回归覆盖：

```text
主聊天工作台一屏布局约束
桌面右侧面板高度约束
窄屏右侧面板隐藏后的主流程高度约束
长文本消息自动换行
输入区固定在视口内
右侧成员、文件、审计面板切换后可见
私信消息不展示线程入口
React 组件映射文档更新
ChatWorkspace 主容器收敛到 500 行以内
文档 HTML 离线样式重新生成
```

阶段 6.5 第二期新增快速回归覆盖：

```text
侧边栏频道与私信条目统一结构
频道未读与 @我 徽标统一样式
私信未读数据接入组件
搜索结果加载态、空状态、错误态补齐
搜索结果区域独立滚动
侧边栏搜索和状态稳定性 E2E 断言补充
```

阶段 6.5 第三期新增快速回归覆盖：

```text
管理后台摘要头展示
管理后台策略区布局展示
管理后台打开后不撑破视口
审计导出入口提升为顶部主操作
安全策略、文件策略、网络策略分区视觉增强
```

阶段 6.5 第四期新增阶段验收覆盖：

```text
窄屏侧栏内部滚动
窄屏右侧面板隐藏
窄屏输入区保持在视口内
窄屏管理后台弹层不溢出
文件面板空状态保留稳定壳层
搜索用例改为自造数据后搜索，避免依赖历史脏数据
无头 E2E 阶段验收 14 个用例全部通过
```

阶段 6.5 第五期新增快速回归覆盖：

```text
消息列表错误态提供重试按钮
发送失败与上传失败展示在输入区上方
发送按钮在空内容、发送中、上传中状态下禁用
输入区补充待输入、上传中状态徽标
主聊天工作台继续保持一屏布局约束
开发期未执行可视化 E2E
```

阶段 6.5 第六期新增快速回归覆盖：

```text
ChatMainPanel 组件样式拆分
MessageList 组件样式拆分
MessageComposer 组件样式拆分
ChatWorkspace.css 从 1421 行收敛到 1056 行
前端类型检查通过
前端生产构建通过
文档 HTML 离线样式重新生成
冒烟 HTML 报告刷新
开发期未执行可视化 E2E
```

阶段 6.5 第七期新增快速回归覆盖：

```text
ChatSidebar 组件样式拆分
ChatWorkspace.css 从 1056 行收敛到 796 行
侧边栏搜索、频道未读、@我、私信在线状态保持原测试定位
前端类型检查通过
前端生产构建通过
文档 HTML 离线样式重新生成
冒烟 HTML 报告刷新
开发期未执行可视化 E2E
```

阶段 6.5 第八期新增快速回归覆盖：

```text
RightPanel 组件样式拆分
ChatWorkspace.css 从 796 行收敛到 474 行
线程、成员、文件、审计面板保持原测试定位
前端类型检查通过
前端生产构建通过
文档 HTML 离线样式重新生成
冒烟 HTML 报告刷新
开发期未执行可视化 E2E
```

阶段 6.5 第九期新增快速回归覆盖：

```text
DiscoverChannelsModal 组件样式拆分
SettingsModal 组件样式拆分
AdminModal 组件样式拆分
ChatWorkspace.css 从 474 行收敛到 92 行
发现频道、设置、管理后台保持原测试定位
前端类型检查通过
前端生产构建通过
文档 HTML 离线样式重新生成
冒烟 HTML 报告刷新
开发期未执行可视化 E2E
```

阶段 6.5 第十期新增快速回归覆盖：

```text
MessageComposer 输入区状态标记增强
输入区 aria-busy 与 aria-live 增强
上传按钮新增 composer-upload-button 测试定位
发送或上传中输入框锁定
E2E 脚本补充输入区 empty 和 ready 状态断言
前端类型检查通过
前端生产构建通过
文档 HTML 离线样式重新生成
冒烟 HTML 报告刷新
开发期未执行可视化 E2E
```

阶段 6.5 第十一期新增快速回归覆盖：

```text
MessageList 消息归属标记增强
消息操作区和回应区语义分组增强
消息操作按钮 aria-label 与 title 增强
自己消息右对齐规则增强
E2E 脚本补充 data-message-owner、消息操作组、消息回应组断言
前端类型检查通过
前端生产构建通过
文档 HTML 离线样式重新生成
冒烟 HTML 报告刷新
开发期未执行可视化 E2E
```

阶段 6.5 第十二期新增快速回归覆盖：

```text
ThreadPanel 统一面板头与回复数量展示
FilePanel 统一面板头与文件数量展示
MemberPanel 统一面板头与成员数量展示
AuditPanel 统一面板头与审计数量展示
线程区独立纵向布局增强
E2E 脚本补充线程详情、成员、文件、审计面板标题断言
前端类型检查通过
前端生产构建通过
文档 HTML 离线样式重新生成
冒烟 HTML 报告刷新
开发期未执行可视化 E2E
```

阶段 6.5 第十三期新增快速回归覆盖：

```text
搜索结果增加频道消息、线程、私信类型标签
搜索结果按类型展示左侧色条
搜索结果按钮增加中文可访问名称
未读与 @我 徽标尺寸和对齐增强
E2E 脚本补充搜索结果类型标签断言
前端类型检查通过
前端生产构建通过
文档 HTML 离线样式重新生成
冒烟 HTML 报告刷新
开发期未执行可视化 E2E
```

阶段 6.5 第十四期新增快速回归覆盖：

```text
窄屏侧栏高度改为动态区间
主聊天区使用剩余视口高度
输入区工具栏横向滚动增强
弹层窄屏近全屏布局增强
管理后台移动端间距压缩
E2E 脚本补充窄屏侧栏高度区间断言
前端类型检查通过
前端生产构建通过
文档 HTML 离线样式重新生成
冒烟 HTML 报告刷新
开发期未执行可视化 E2E
```

阶段 6.5 第十五期阶段验收覆盖：

```text
完整无头 E2E 已执行
Playwright 回归 14 个用例全部通过
首次验收发现线程回复按钮选择器过宽，已收窄到线程详情面板内
冒烟测试通过
文档 HTML 离线样式重新生成
阶段 6.5 状态已改为已完成
未执行可视化 E2E
```

阶段 6.5 可感知 UI 优化补丁新增快速回归覆盖：

```text
频道信息条可见并展示安全协作
频道标题区和频道图标可见
输入区空状态展示输入消息后发送
输入区有内容时展示准备发送
侧边栏当前频道选中项保持稳定宽度
消息长文本仍不撑破消息区
右侧文件、成员、审计面板标题继续可见
冒烟脚本使用专用未读验证频道，避免当前浏览器实时刷新干扰未读断言
开发期未执行可视化 E2E
```

阶段 6.5 收尾验收补充记录：

```text
首次无头 E2E 因已有 5188 服务占用未进入用例，已停止旧服务后重跑
首次完整用例发现输入区状态文案被草稿状态覆盖，已修正为有内容时优先展示准备发送
首次完整用例发现测试数据频道过多时侧边栏频道列表覆盖发现频道和管理后台按钮，已收紧频道列表高度并提升操作按钮层级
第二次完整无头 E2E 通过，14 个用例全部通过
未执行可视化 E2E
```

最近一次一屏布局巡检已通过：

```text
innerHeight: 900
bodyScrollHeight: 900
rootHeight: 900
appShell: 900
workspace: 900
mainBottom: 900
sidebarBottom: 900
composerBottom: 900
```

历史快速回归记录：

```text
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm run smoke
git diff --check
```

审计面板、文件上传和一屏布局约束新增后，已补充 E2E 用例脚本；按照开发期规则，未执行可视化 E2E，等待阶段验收时统一运行。

阶段 4 验收说明：

```text
本次已执行无头 E2E 阶段验收，并生成 playwright-report/index.html。
可视化 E2E 仅在需要人工观看过程时执行 npm run e2e:headed。
```
