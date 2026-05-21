import type { Workspace, Message } from "../../types/chat";

export const demoWorkspace: Workspace = {
  name: "BeeChat",
  securityMode: "内网审计",
  directUnreadCounts: { "3": 1 },
  channels: [
    { id: 1, name: "general", description: "日常协作与公告", announcement: "阶段 5 正在验证频道公告与置顶消息。", joined: true, memberCount: 128, unreadCount: 0, mentionCount: 0 },
    { id: 2, name: "random", description: "轻松分享与随想", announcement: "", joined: true, memberCount: 48, unreadCount: 0, mentionCount: 0 },
    { id: 3, name: "engineering", description: "研发项目协作", announcement: "研发频道请优先同步当前迭代风险。", joined: true, memberCount: 34, unreadCount: 3, mentionCount: 1 },
    { id: 4, name: "announcements", description: "公司公告", announcement: "公司公告由管理员统一发布。", joined: true, memberCount: 128, unreadCount: 0, mentionCount: 0 }
  ],
  users: [
    { id: 1, account: "13677889001", name: "当前用户", role: "ADMIN", avatarText: "我", avatarColor: "#4A9FD8", online: true },
    { id: 2, account: "zhangsan", name: "张三", role: "USER", avatarText: "张", avatarColor: "#F59E43", online: true },
    { id: 3, account: "lisi", name: "李四", role: "USER", avatarText: "李", avatarColor: "#52A9E8", online: true },
    { id: 4, account: "wangwu", name: "王五", role: "USER", avatarText: "王", avatarColor: "#41C585", online: false }
  ]
};

export const demoMessages: Message[] = [
  {
    id: 101,
    channelId: 1,
    senderId: 2,
    senderName: "张三",
    avatarText: "张",
    avatarColor: "#F59E43",
    content: "大家好！新版聊天工具的 UI 设计稿已经出来了，请大家看看效果如何？",
    createdAt: Date.now() - 1200000,
    edited: false,
    pinned: true,
    favoriteUserIds: [1],
    reactions: { "👍": [1, 2], "👀": [3] },
    mentionUserIds: [],
    revoked: false,
    sensitive: false,
    deliveryStatus: "已读 8 人",
    replyCount: 3
  },
  {
    id: 102,
    channelId: 1,
    senderId: 3,
    senderName: "李四",
    avatarText: "李",
    avatarColor: "#52A9E8",
    content: "设计风格挺清爽，相比传统企业 IM，线程和审计提示更适合内部协作。",
    createdAt: Date.now() - 980000,
    edited: false,
    pinned: false,
    favoriteUserIds: [],
    reactions: { "✅": [1] },
    mentionUserIds: [1],
    revoked: false,
    sensitive: false,
    deliveryStatus: "已读 12 人",
    replyCount: 1,
    file: {
      originalName: "BeeChat-MVP-接口说明.pdf",
      size: 245760,
      path: "/uploads/beechat-api.pdf"
    }
  },
  {
    id: 103,
    channelId: 1,
    senderId: 1,
    senderName: "当前用户",
    avatarText: "我",
    avatarColor: "#4A9FD8",
    content: "同意！我特别喜欢这种干净排版，加上内网审计会更适合企业使用。",
    createdAt: Date.now() - 700000,
    edited: false,
    pinned: false,
    favoriteUserIds: [],
    reactions: {},
    mentionUserIds: [],
    revoked: false,
    sensitive: false,
    deliveryStatus: "已读 12 人 · 已审计",
    replyCount: 0
  }
];
