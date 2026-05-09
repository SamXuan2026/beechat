# BeeChat MVP

BeeChat 是面向企业内网私有化部署的轻量协同聊天系统 MVP。当前版本已从纯演示版升级为可持续迭代底座：本地持久化、登录态、权限、实时推送、审计、文件、搜索均已具备最小闭环。

## 已实现

- 账号密码登录、会话恢复、退出登录
- 工作区、频道、私信列表
- 频道消息、私信消息、线程回复
- 手写 WebSocket 实时推送
- SQLite 本地持久化，同时保留 JSON 快照便于排障
- 管理员/普通用户角色控制
- 频道成员查看、邀请、移除
- 创建频道、加入频道
- 未读数与已读清零
- 消息编辑、撤回
- 文件上传、下载、权限校验
- 消息搜索
- 敏感词提示
- 审计日志与分类筛选
- 独立前端界面

## 账号

```text
管理员：13677889001 / admin123
普通用户：zhangsan / 123456
普通用户：lisi / 123456
```

## 启动

推荐使用脚本：

```bash
./start.sh
```

或直接运行：

```bash
npm start
```

访问：

```text
http://127.0.0.1:5188
```

Docker 启动：

```bash
docker compose up -d --build
```

## 状态与停止

```bash
./status.sh
./stop.sh
```

## 冒烟验证

服务启动后执行：

```bash
npm run smoke
```

冒烟覆盖：健康检查、登录态、WebSocket、频道消息、私信、编辑、撤回、频道权限、成员管理、文件上传下载、搜索、审计筛选。

## 文档

```text
docs/API.md             接口文档
docs/DEPLOYMENT.md      部署说明
docs/ITERATION_PLAN.md  后续迭代计划
migrations/001_init.sql SQLite 初始化结构
Dockerfile              容器镜像定义
docker-compose.yml      单机部署编排
```

## 数据目录

```text
data/beechat.sqlite   SQLite 本地数据
data/store.json       JSON 快照
data/uploads/         上传文件
logs/beechat.log      服务日志
run/beechat.pid       运行进程号
```

这些运行数据已在 `.gitignore` 中排除。

## 说明

当前版本使用 Node.js 内置能力实现，无外部依赖。SQLite 使用 `node:sqlite`，需要较新的 Node.js 版本支持。
