const path = require("path");

const adapterPath = path.join(__dirname, "..", "server", "database", "postgres-adapter.js");
const adapter = require(adapterPath);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectThrow(fn, text) {
  try {
    fn();
  } catch (error) {
    assert(error.message.includes(text), `错误提示异常：${error.message}`);
    return;
  }
  throw new Error(`预期抛出错误：${text}`);
}

function main() {
  assert(typeof adapter.createPostgresAdapter === "function", "缺少 createPostgresAdapter");
  assert(typeof adapter.PostgresAdapter === "function", "缺少 PostgresAdapter");
  assert(typeof adapter.assertDatabaseUrl === "function", "缺少连接串校验");
  assert(typeof adapter.normalizeMigrationFile === "function", "缺少迁移文件解析");

  expectThrow(() => adapter.assertDatabaseUrl(""), "不能为空");
  expectThrow(() => adapter.assertDatabaseUrl("mysql://127.0.0.1/beechat"), "格式无效");

  const migration = adapter.normalizeMigrationFile("001_init.sql");
  assert(migration.version === "001", "迁移版本解析异常");
  assert(migration.name === "001_init.sql", "迁移文件名解析异常");
  assert(adapter.normalizeMigrationFile("readme.md") === null, "无效迁移文件应返回空");

  const instance = adapter.createPostgresAdapter({
    databaseUrl: "postgres://beechat:password@127.0.0.1:5432/beechat"
  });
  assert(typeof instance.connect === "function", "缺少 connect");
  assert(typeof instance.query === "function", "缺少 query");
  assert(typeof instance.transaction === "function", "缺少 transaction");
  assert(typeof instance.health === "function", "缺少 health");
  assert(typeof instance.runMigrations === "function", "缺少 runMigrations");

  console.log("BeeChat PostgreSQL 查询适配层检查通过");
}

main();
