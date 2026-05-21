const fs = require("fs");
const path = require("path");
const contracts = require("../server/repositories/contracts");
const sqlite = require("../server/repositories/sqlite-repository");
const postgres = require("../server/repositories/postgres-repository");

const serverFile = path.join(__dirname, "..", "server", "index.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fakeSqliteDb() {
  return {
    prepare() {
      return {
        get() {
          return null;
        },
        all() {
          return [];
        }
      };
    }
  };
}

function fakeUser() {
  return {
    id: 1,
    account: "tester",
    name: "测试用户",
    avatarText: "测",
    avatarColor: "#4A90E2"
  };
}

function fakePostgresAdapter() {
  return {
    async query() {
      return { rows: [] };
    },
    async migrationStatus() {
      return [];
    },
    async health() {
      return { provider: "postgres", status: "UP" };
    }
  };
}

async function main() {
  assert(Array.isArray(contracts.REQUIRED_METHODS), "仓储契约方法列表异常");
  assert(contracts.REQUIRED_METHODS.includes("channelById"), "仓储契约缺少频道读取");
  assert(contracts.REQUIRED_METHODS.includes("channelMessages"), "仓储契约缺少消息读取");
  assert(contracts.REQUIRED_METHODS.includes("createDirectMessage"), "仓储契约缺少私信写入");
  assert(contracts.REQUIRED_METHODS.includes("updateMessageContent"), "仓储契约缺少消息编辑写入");
  assert(contracts.REQUIRED_METHODS.includes("revokeMessage"), "仓储契约缺少消息撤回写入");

  const sqliteRepository = sqlite.createSQLiteRepository({
    db: fakeSqliteDb(),
    users: [],
    publicMessage: (message) => message
  });
  assert(contracts.assertRepositoryContract(sqliteRepository), "SQLite 仓储契约检查失败");
  assert(sqliteRepository.channelById(1) === null, "SQLite 空频道读取异常");
  assert(sqliteRepository.channelMessages(1, null, null, 30).items.length === 0, "SQLite 空消息分页异常");
  assert(sqliteRepository.directMessages(1, 2, null, 30).items.length === 0, "SQLite 空私信分页异常");
  assert(sqliteRepository.channelFiles(1).length === 0, "SQLite 空频道文件列表异常");
  assert(sqliteRepository.audits("all").length === 0, "SQLite 空审计读取异常");
  const created = sqliteRepository.createChannelMessage({
    id: 1001,
    channelId: 1,
    sender: fakeUser(),
    content: "仓储写入测试",
    sensitive: false,
    mentionUserIds: [],
    createdAt: "2026-05-19T00:00:00.000Z"
  });
  assert(created.id === 1001 && created.messageType === "CHANNEL", "SQLite 频道消息写入异常");
  const direct = sqliteRepository.createDirectMessage({
    id: 1002,
    sender: fakeUser(),
    receiver: { ...fakeUser(), id: 2, name: "接收用户" },
    content: "私信仓储写入测试",
    sensitive: false,
    createdAt: "2026-05-19T00:01:00.000Z"
  });
  assert(direct.id === 1002 && direct.messageType === "DIRECT" && direct.receiverId === 2, "SQLite 私信写入异常");
  const edited = sqliteRepository.updateMessageContent(1002, {
    content: "私信仓储编辑测试",
    sensitive: true,
    editedAt: "2026-05-19T00:02:00.000Z"
  });
  assert(edited.edited === true && edited.content === "私信仓储编辑测试" && edited.sensitive === true, "SQLite 消息编辑写入异常");
  const revoked = sqliteRepository.revokeMessage(1002, {
    revokedAt: "2026-05-19T00:03:00.000Z"
  });
  assert(revoked.revoked === true && revoked.deliveryStatus === "已撤回", "SQLite 消息撤回写入异常");

  const postgresRepository = postgres.createPostgresRepository({
    adapter: fakePostgresAdapter(),
    users: [],
    publicMessage: (message) => message
  });
  assert(contracts.assertRepositoryContract(postgresRepository), "PostgreSQL 仓储契约检查失败");
  assert(await postgresRepository.channelById(1) === null, "PostgreSQL 空频道读取异常");
  assert((await postgresRepository.channelMessages(1, null, null, 30)).items.length === 0, "PostgreSQL 空消息分页异常");
  assert((await postgresRepository.directMessages(1, 2, null, 30)).items.length === 0, "PostgreSQL 空私信分页异常");
  assert((await postgresRepository.channelFiles(1)).length === 0, "PostgreSQL 空频道文件列表异常");
  assert((await postgresRepository.audits("all")).length === 0, "PostgreSQL 空审计读取异常");
  assert((await postgresRepository.health()).provider === "postgres", "PostgreSQL 仓储健康检查异常");

  const serverSource = fs.readFileSync(serverFile, "utf8");
  assert(serverSource.includes("createSQLiteRepository"), "主服务未初始化 SQLite 仓储");
  assert(serverSource.includes("readRepository().channelById"), "主服务未接入仓储频道读取");
  assert(serverSource.includes("readRepository().channelMembers"), "主服务未接入仓储成员读取");
  assert(serverSource.includes("readRepository().channelMessages"), "主服务未接入仓储消息分页读取");
  assert(serverSource.includes("readRepository().directMessages"), "主服务未接入仓储私信分页读取");
  assert(serverSource.includes("readRepository().channelFiles"), "主服务未接入仓储文件读取");
  assert(serverSource.includes("readRepository().audits"), "主服务未接入仓储审计读取");
  assert(serverSource.includes("readRepository().createChannelMessage"), "主服务未接入仓储频道消息写入");
  assert(serverSource.includes("readRepository().createDirectMessage"), "主服务未接入仓储私信写入");
  assert(serverSource.includes("readRepository().updateMessageContent"), "主服务未接入仓储消息编辑写入");
  assert(serverSource.includes("readRepository().revokeMessage"), "主服务未接入仓储消息撤回写入");

  console.log("BeeChat 仓储契约检查通过");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
