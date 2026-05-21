# BeeChat 数据库适配方案

## 一、目标

阶段 6 第十六期目标是将 BeeChat 从单机 SQLite 数据形态逐步升级为可生产部署的 PostgreSQL 数据底座，并继续把消息编辑与撤回写入链路接入业务仓储。

本期先交付：

- PostgreSQL 表结构迁移脚本。
- 生产环境变量约定。
- SQLite 到 PostgreSQL 迁移路径。
- PostgreSQL 一次性导入 SQL 生成脚本。
- 数据库运行模式配置校验。
- PostgreSQL 查询适配层第一版。
- 业务仓储契约与 SQLite/PostgreSQL 双实现骨架。
- 主服务频道、成员、频道消息分页、私信分页、频道文件列表、审计查询只读路径接入 SQLite 仓储。
- PostgreSQL 仓储补齐频道消息分页、私信分页、频道文件列表与审计筛选只读查询。
- 主服务频道消息与线程回复发送写入路径接入 SQLite 仓储。
- 主服务私信发送写入路径接入 SQLite 仓储。
- 主服务消息编辑与消息撤回写入路径接入 SQLite 仓储。
- PostgreSQL 频道消息、私信、消息编辑与消息撤回写入仓储保持显式未启用保护。
- 回滚与验证方案。
- 快速回归检查脚本。

## 二、当前状态

当前运行形态：

```text
Node.js 原生服务
SQLite 本地数据库：data/beechat.sqlite
JSON 快照：data/store.json
上传文件：data/uploads/
```

当前适合 MVP、单机演示和小团队本地试用，不适合正式多人生产。

主要限制：

- SQLite 单文件写入并发能力有限。
- 缺少数据库级外键与索引治理。
- 备份恢复依赖文件复制。
- 后续 Redis、对象存储、审计归档接入时需要更清晰的数据边界。

## 三、目标架构

```text
BeeChat 服务
  |
  |-- PostgreSQL：用户、频道、消息、审计、会话、未读状态
  |-- 对象存储：上传文件
  |-- Redis：会话缓存、WebSocket 广播、在线状态
```

第一阶段仍保留 SQLite 默认运行能力，避免破坏现有 MVP。

生产环境通过环境变量选择：

```text
BEECHAT_DB_PROVIDER=sqlite
BEECHAT_DB_PROVIDER=postgres
```

当前版本默认并仅启用 SQLite 运行路径。`postgres` 模式已经纳入配置校验，但运行适配层尚未启用；如果配置为 `postgres`，服务会在启动阶段给出明确错误，避免误以为已经完成生产切库。

## 四、PostgreSQL 查询适配层

适配层文件：

```text
server/database/postgres-adapter.js
```

当前能力：

- PostgreSQL 连接串格式校验。
- `pg.Pool` 连接池封装。
- `query(sql, params)` 参数化查询入口。
- `transaction(handler)` 事务封装，自动提交和回滚。
- `health()` 数据库健康检查。
- `migrationStatus()` 迁移状态读取。
- `runMigrations()` 执行 `migrations/postgres/*.sql`。

当前限制：

- 主服务默认仍不切换到 PostgreSQL。
- 本地未安装 `pg` 驱动时，只有真正连接 PostgreSQL 时才会提示缺少驱动。
- 业务读写仓储尚未从 SQLite 抽象到 PostgreSQL，放入后续迭代。

## 五、业务仓储契约与主服务接入

契约文件：

```text
server/repositories/contracts.js
```

SQLite 实现骨架：

```text
server/repositories/sqlite-repository.js
```

PostgreSQL 实现骨架：

```text
server/repositories/postgres-repository.js
```

当前契约方法：

```text
channelById
channelMembers
channelMessages
directMessages
channelFiles
audits
createChannelMessage
createDirectMessage
migrationStatus
health
```

当前策略：

- SQLite 仓储承接当前主服务中的频道、成员、消息、文件、审计读取形态，并承接频道消息、线程回复、私信发送、消息编辑与消息撤回写入。
- PostgreSQL 仓储先实现频道、成员、频道消息分页、私信分页、频道文件列表、审计、迁移状态和健康检查。
- PostgreSQL 频道消息、私信、消息编辑与消息撤回写入仍显式报错，避免被误用。
- 主服务已初始化 SQLite 仓储，并优先迁移低风险读取路径、消息发送写入路径和消息状态变更写入路径。

已接入主服务的仓储路径：

```text
GET /api/channels/:id/members  频道读取与成员列表
GET /api/channels/:id/messages 频道存在性、访问权限判断与消息分页
GET /api/direct/:id/messages   私信分页
GET /api/channels/:id/files    频道读取与文件列表
GET /api/audits                审计组合筛选
GET /api/admin/audits/export   审计导出读取
POST /api/messages             频道消息和线程回复发送
POST /api/direct/messages      私信发送
PUT /api/messages/:id          消息编辑
POST /api/messages/:id/revoke  消息撤回
```

暂未迁移的路径：

```text
文件上传发送
```

当前频道消息、线程回复、私信发送、消息编辑与消息撤回已经接入 SQLite 仓储，但仍保持现有内存主状态加 SQLite 快照持久化模型。文件上传发送原实现暂时保留，下一期再继续迁移剩余写入链路。

## 六、PostgreSQL 表结构

迁移脚本位置：

```text
migrations/postgres/001_init.sql
```

核心设计：

- 使用 `BIGINT` 保持当前数字 ID 兼容。
- 使用 `password_hash` 保存本地账号密码哈希，后续接入 SSO 后可降级为兼容字段。
- 使用 `JSONB` 存储收藏用户、表情回应、@ 人、文件元数据。
- 使用 `TIMESTAMPTZ` 存储带时区时间。
- 增加用户、频道、消息、文件、审计、会话、未读状态外键。
- 增加消息列表、私信列表、审计查询常用索引。

## 七、SQLite 到 PostgreSQL 迁移路径

推荐迁移步骤：

1. 停止 BeeChat 服务。
2. 执行 `npm run backup`，保留 SQLite、JSON 快照和上传文件。
3. 创建 PostgreSQL 数据库和专用账号。
4. 执行 `migrations/postgres/001_init.sql`。
5. 执行一次性导出脚本读取 `data/store.json`，生成 PostgreSQL 导入 SQL。
6. 配置 `.env.prod`：

```text
BEECHAT_DB_PROVIDER=postgres
BEECHAT_DATABASE_URL=postgres://beechat:替换密码@127.0.0.1:5432/beechat
```

7. 使用 `psql` 在 PostgreSQL 执行生成的 SQL。
8. 启动服务并执行快速回归。
9. 确认消息、文件、审计、权限、搜索、未读均正常。

导出命令：

```bash
npm run db:export:postgres
```

生成文件：

```text
backups/postgres/beechat-postgres-seed.sql
```

导入顺序：

```text
users
channels
channel_members
messages
files
audits
unread_state
app_state
```

脚本特性：

- 使用事务包裹导入过程。
- 导入前按外键依赖顺序清理目标表。
- 使用 `ON CONFLICT` 保证重复执行时可覆盖更新。
- 不迁移活动会话和登录失败锁定状态，切库后用户需要重新登录。
- 将清理后的 `store.json` 快照写入 `app_state`，便于回滚和核查。
- 当前不直接连接 PostgreSQL，避免在未安装数据库驱动时破坏开发链路。

## 八、回滚策略

回滚必须以数据不丢失为优先。

推荐策略：

- 切换 PostgreSQL 前保留完整 `backups/`。
- 首次迁移后保留 SQLite 原文件至少一个发布周期。
- PostgreSQL 上线失败时，恢复 `.env.prod` 为 `BEECHAT_DB_PROVIDER=sqlite`。
- 回滚后使用最近一次 `backups/beechat-<时间戳>/` 覆盖 `data/`。
- 回滚完成后执行 `npm run smoke`。

## 九、验证方式

静态配置检查：

```bash
npm run db:plan:check
```

生成 PostgreSQL 导入 SQL：

```bash
npm run db:export:postgres
```

数据库运行模式检查：

```bash
npm run db:runtime:check
```

PostgreSQL 查询适配层检查：

```bash
npm run db:adapter:check
```

仓储契约检查：

```bash
npm run db:repository:check
```

检查内容：

- `postgres` 模式缺少 `BEECHAT_DATABASE_URL` 时必须启动失败。
- 不支持的数据库类型必须启动失败。
- PostgreSQL 运行适配层未启用前必须启动失败。
- 默认 `sqlite` 模式继续保持 MVP 可运行。

快速回归：

```bash
npm run smoke
```

文档构建：

```bash
npm run docs:build
```

当前阶段不要求连接真实 PostgreSQL 实例；真实连接和完整读写切换放入后续迭代执行。
