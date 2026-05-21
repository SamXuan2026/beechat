# BeeChat MVP 部署说明

## 本机启动

```bash
./start.sh
```

状态检查：

```bash
./status.sh
```

停止：

```bash
./stop.sh
```

访问：

```text
http://127.0.0.1:5188
```

## Docker 部署

构建并启动：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f beechat
```

停止：

```bash
docker compose down
```

## 生产 Compose 部署

准备环境变量：

```bash
cp .env.prod.example .env.prod
```

按内网策略修改：

```text
BEECHAT_BIND=127.0.0.1   仅本机反向代理访问
BEECHAT_BIND=0.0.0.0     内网网段直接访问
BEECHAT_PORT=5188        服务端口
```

构建并启动生产配置：

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

检查状态：

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
curl http://127.0.0.1:5188/api/health
```

停止：

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

生产配置包含：

- 多阶段 Docker 构建，镜像内包含 Vite 前端产物。
- `data/`、`logs/`、`backups/` 挂载到宿主机。
- Docker 健康检查。
- Docker JSON 日志轮转。
- `no-new-privileges` 基础容器安全约束。

## 环境变量

```text
PORT 服务端口，默认 5188
BEECHAT_DB_PROVIDER 数据库类型，当前默认 sqlite，后续生产可切换 postgres
BEECHAT_DATABASE_URL PostgreSQL 连接串，仅 BEECHAT_DB_PROVIDER=postgres 时使用
```

## PostgreSQL 适配计划

阶段 6 第四期已补充 PostgreSQL 生产数据库适配骨架。

交付文件：

```text
migrations/postgres/001_init.sql
docs/beechat/DATABASE_PLAN.md
scripts/check-postgres-plan.js
scripts/export-postgres-seed.js
scripts/check-database-runtime.js
server/database/postgres-adapter.js
scripts/check-postgres-adapter.js
server/repositories/contracts.js
server/repositories/sqlite-repository.js
server/repositories/postgres-repository.js
scripts/check-repository-contract.js
```

当前阶段仍默认使用 SQLite，避免破坏现有 MVP 运行。主服务已把频道读取、成员读取、频道消息分页、私信分页、频道文件列表和审计查询等低风险只读路径接入 SQLite 仓储；频道消息、线程回复、私信发送、消息编辑和消息撤回写入路径已接入 SQLite 仓储。文件上传发送仍保持原链路；PostgreSQL 写入仍未启用。生产切换 PostgreSQL 前，需要先执行完整备份、数据迁移和真实数据库回归。

环境变量约定：

```text
BEECHAT_DB_PROVIDER=sqlite
BEECHAT_DB_PROVIDER=postgres
BEECHAT_DATABASE_URL=postgres://beechat:替换密码@127.0.0.1:5432/beechat
```

检查 PostgreSQL 适配计划：

```bash
npm run db:plan:check
```

生成 PostgreSQL 一次性导入 SQL：

```bash
npm run db:export:postgres
```

生成文件：

```text
backups/postgres/beechat-postgres-seed.sql
```

检查数据库运行模式保护：

```bash
npm run db:runtime:check
```

检查 PostgreSQL 查询适配层：

```bash
npm run db:adapter:check
```

检查业务仓储契约：

```bash
npm run db:repository:check
```

当前版本默认并仅启用 SQLite 运行路径。`BEECHAT_DB_PROVIDER=postgres` 已纳入配置校验，但主服务运行切换尚未启用；生产切库前必须先完成 PostgreSQL 仓储读写实现、连接适配和真实库回归。

详细迁移路径、回滚策略和验证方式见：

```text
docs/beechat/DATABASE_PLAN.md
```

## 运维检查

健康检查：

```bash
curl http://127.0.0.1:5188/api/health
```

运行指标：

```bash
curl http://127.0.0.1:5188/api/metrics -H "Authorization: Bearer <token>"
```

`/api/metrics` 仅管理员和审计员可访问，返回进程、内存、会话、实时连接、数据文件大小、日志大小、业务计数和迁移状态。

## 数据目录

```text
data/beechat.sqlite SQLite 本地数据
data/store.json     JSON 快照
data/uploads/       上传文件
logs/beechat.log    服务日志
run/beechat.pid     本机脚本进程号
backups/            本地备份产物
```

## 本地备份

执行：

```bash
npm run backup
```

备份内容：

```text
data/beechat.sqlite
data/store.json
data/uploads/
manifest.json
```

备份目录：

```text
backups/beechat-<时间戳>/
```

`manifest.json` 会记录备份时间、复制结果和上传文件清单。`backups/` 默认不提交到 Git。

## 结构化日志

服务会将运行日志写入：

```text
logs/beechat.log
```

日志格式为 JSON Lines，每行一条事件，便于接入日志采集、审计归档和离线排查。

当前覆盖事件：

```text
server.started       服务启动
migration.applied    数据库迁移执行
http.request         HTTP 请求访问
http.error           HTTP 异常
audit.recorded       审计记录写入
```

日志达到 5MB 后会自动轮转为：

```text
logs/beechat-<时间戳>.log
```

生产环境建议将 `logs/` 挂载到独立目录，并接入系统日志轮转或集中采集。

## Nginx 反向代理

样例文件：

```text
deploy/nginx/beechat.conf
```

该样例包含普通 HTTP 代理与 `/api/realtime` WebSocket 升级配置。生产环境建议在 Nginx 层启用 HTTPS，并将 `server_name` 替换为企业内网域名。

## 数据库迁移

服务启动时会自动扫描：

```text
migrations/*.sql
```

执行规则：

- 文件名格式：`001_init.sql`、`002_xxx.sql`
- 迁移版本取文件名前缀，例如 `001`
- 执行记录写入 `schema_migrations`
- 已执行版本不会重复执行
- 任一迁移失败会回滚当前迁移并阻止服务启动

健康检查会返回启动时间、运行时长和已执行迁移：

```bash
curl http://127.0.0.1:5188/api/health
```

## 内网部署建议

- 使用反向代理统一暴露 HTTPS。
- 将 `data/` 挂载到独立数据盘。
- 将 `logs/` 接入日志轮转。
- 定期备份 `data/beechat.sqlite` 与 `data/uploads/`。
- 生产环境建议将默认账号密码替换为企业身份源或初始化脚本。

## 验证

```bash
npm run smoke
```

冒烟测试覆盖登录、实时连接、消息、私信、权限、成员、文件、搜索、审计。
