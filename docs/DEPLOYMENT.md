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

## 环境变量

```text
PORT 服务端口，默认 5188
```

## 数据目录

```text
data/beechat.sqlite SQLite 本地数据
data/store.json     JSON 快照
data/uploads/       上传文件
logs/beechat.log    服务日志
run/beechat.pid     本机脚本进程号
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
