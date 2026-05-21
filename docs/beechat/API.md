# BeeChat MVP 接口文档

基础地址：

```text
http://127.0.0.1:5188
```

除登录、健康检查外，其余接口建议携带：

```text
Authorization: Bearer <token>
```

## 通用响应

```json
{
  "success": true,
  "code": "OK",
  "message": "处理成功",
  "data": {}
}
```

## 健康检查

```http
GET /api/health
```

返回服务状态、存储类型、启动时间、运行时长、已执行数据库迁移和当前时间。

## 运行指标

```http
GET /api/metrics
Authorization: Bearer <token>
```

仅管理员和审计员可访问。返回进程、内存、实时连接、会话、数据文件大小、日志大小、业务计数和迁移状态，用于内网运维巡检。

## 登录

```http
POST /api/login
Content-Type: application/json
```

```json
{
  "account": "13677889001",
  "password": "admin123"
}
```

## 恢复会话

```http
GET /api/session
Authorization: Bearer <token>
```

## 退出登录

```http
POST /api/logout
Authorization: Bearer <token>
```

退出后当前会话立即失效，工作区用户在线状态会通过 WebSocket `presence:updated` 事件同步。

## 工作区

```http
GET /api/workspace
Authorization: Bearer <token>
```

返回频道、用户、未读数。用户对象中的 `online` 由当前有效会话与实时连接动态计算，不再依赖静态种子数据。

频道对象新增：

```json
{
  "announcement": "频道公告"
}
```

## 频道消息

```http
GET /api/channels/{channelId}/messages
Authorization: Bearer <token>
```

分页参数：

```text
pageSize  每页条数，默认 30，最大 100
beforeId  加载指定消息 ID 之前的更早消息
```

分页响应：

```json
{
  "items": [],
  "hasMore": true,
  "nextBeforeId": 101,
  "pageSize": 30
}
```

线程回复：

```http
GET /api/channels/{channelId}/messages?parentId={messageId}
```

线程回复同样支持 `pageSize` 和 `beforeId`。

发送频道消息：

```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "channelId": 1,
  "content": "消息内容"
}
```

消息内容支持 `@姓名`、`@账号` 或 `@头像字` 提醒频道成员。后端会返回 `mentionUserIds`，并在被提醒用户的频道未读中累计 `mentionCount`。用户读取频道消息后，该频道的 `unreadCount` 与 `mentionCount` 会清零。

发送线程回复：

```json
{
  "channelId": 1,
  "parentId": 101,
  "content": "线程回复"
}
```

## 私信

```http
GET /api/direct/{userId}/messages
Authorization: Bearer <token>
```

私信消息同样返回分页结构，并支持 `pageSize` 和 `beforeId`。

```http
POST /api/direct/messages
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "receiverId": 2,
  "content": "私信内容"
}
```

## 消息编辑与撤回

```http
PUT /api/messages/{messageId}
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "content": "编辑后的内容"
}
```

```http
POST /api/messages/{messageId}/revoke
Authorization: Bearer <token>
```

置顶或取消置顶消息，管理员与频道管理员可用：

```http
POST /api/messages/{messageId}/pin
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "pinned": true
}
```

收藏或取消收藏消息，消息可见用户可用：

```http
POST /api/messages/{messageId}/favorite
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "favorited": true
}
```

添加或取消表情回应，消息可见用户可用：

```http
POST /api/messages/{messageId}/reactions
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "emoji": "👍",
  "reacted": true
}
```

当前支持 `👍`、`✅`、`👀` 三类快捷回应。

## 频道与成员

创建频道，管理员可用：

```http
POST /api/channels
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "name": "project-a",
  "description": "项目协作频道"
}
```

加入频道：

```http
POST /api/channels/{channelId}/join
Authorization: Bearer <token>
```

查看频道成员：

```http
GET /api/channels/{channelId}/members
Authorization: Bearer <token>
```

维护频道说明与公告，管理员或该频道频道管理员可用：

```http
PUT /api/admin/channels/{channelId}
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "description": "项目协作频道",
  "announcement": "本周优先同步阶段 5 验收风险"
}
```

邀请成员，管理员可用：

```http
POST /api/channels/{channelId}/members
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "userId": 2
}
```

移除成员，管理员可用：

```http
DELETE /api/channels/{channelId}/members/{userId}
Authorization: Bearer <token>
```

## 文件

```http
POST /api/files
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

字段：

```text
file       文件
channelId 频道 ID
receiverId 私信接收人 ID
```

下载：

```http
GET /api/files/{storedName}
Authorization: Bearer <token>
```

查看频道文件列表：

```http
GET /api/channels/{channelId}/files
Authorization: Bearer <token>
```

返回当前频道最近 100 条文件消息。图片文件可由前端直接使用 `file.path` 做预览。

## 搜索

```http
GET /api/search?q=关键词
Authorization: Bearer <token>
```

返回最近 30 条可见消息，包含 `id`、`messageType`、`channelId`、`peerId`、`title`、`senderName`、`content`、`createdAt`。前端可用 `channelId + id` 切换频道并高亮目标消息。

## 审计

仅管理员和审计员可访问。

```http
GET /api/audits?type=all
Authorization: Bearer <token>
```

组合筛选：

```http
GET /api/audits?type=file&operator=13677889001&q=文件&from=2026-05-01&to=2026-05-15
Authorization: Bearer <token>
```

筛选类型：

```text
all
message
file
member
login
```

## 管理后台

管理总览、安全策略、文件策略、用户角色配置仅管理员可访问。频道说明维护允许管理员或已加入该频道的频道管理员访问。

```http
GET /api/admin/overview
Authorization: Bearer <token>
```

返回用户、频道、最近审计、安全策略与管理指标。

```http
PUT /api/admin/users/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "ADMIN",
  "disabled": false
}
```

保存用户角色与停用状态。当前管理员不能停用自己，也不能降低自己的管理员权限。

角色：

```text
ADMIN          管理员
AUDITOR        审计员
CHANNEL_ADMIN  频道管理员
USER           成员
```

```http
PUT /api/admin/security-policy
Authorization: Bearer <token>
Content-Type: application/json

{
  "maxLoginFailures": 5,
  "lockMinutes": 15,
  "minPasswordLength": 8,
  "requireNumber": true
}
```

保存登录失败锁定与密码策略配置。

```http
PUT /api/admin/upload-policy
Authorization: Bearer <token>
Content-Type: application/json

{
  "allowedExtensions": [".txt", ".pdf", ".png"],
  "maxFileSizeMb": 5
}
```

保存文件上传策略。服务端会按策略校验文件大小与扩展名。

```http
PUT /api/admin/network-policy
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": true,
  "allowedIps": ["127.0.0.1", "10.0.0.8"]
}
```

保存网络访问策略。默认关闭；开启时，服务端会统一拦截非白名单 IP。

```http
GET /api/admin/audits/export?token=<token>
```

导出 CSV 格式审计日志。管理员和审计员可访问，浏览器下载场景支持通过查询参数传入 token。

## 实时推送

```text
ws://127.0.0.1:5188/api/realtime?token=<token>
```

事件示例：

```json
{
  "event": "message:channel",
  "payload": {
    "message": {}
  },
  "time": "2026-05-09T00:00:00.000Z"
}
```
