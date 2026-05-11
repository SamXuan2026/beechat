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

返回服务状态、存储类型、已执行数据库迁移和当前时间。

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

## 工作区

```http
GET /api/workspace
Authorization: Bearer <token>
```

返回频道、用户、未读数。

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

## 搜索

```http
GET /api/search?q=关键词
Authorization: Bearer <token>
```

## 审计

```http
GET /api/audits?type=all
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
