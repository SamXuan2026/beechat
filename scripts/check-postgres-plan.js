const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const postgresMigration = path.join(root, "migrations", "postgres", "001_init.sql");
const deploymentDoc = path.join(root, "docs", "beechat", "DEPLOYMENT.md");
const databaseDoc = path.join(root, "docs", "beechat", "DATABASE_PLAN.md");
const envExample = path.join(root, ".env.prod.example");
const exportScript = path.join(root, "scripts", "export-postgres-seed.js");
const runtimeScript = path.join(root, "scripts", "check-database-runtime.js");
const adapterScript = path.join(root, "scripts", "check-postgres-adapter.js");
const adapterFile = path.join(root, "server", "database", "postgres-adapter.js");
const repositoryScript = path.join(root, "scripts", "check-repository-contract.js");
const repositoryContract = path.join(root, "server", "repositories", "contracts.js");
const sqliteRepository = path.join(root, "server", "repositories", "sqlite-repository.js");
const postgresRepository = path.join(root, "server", "repositories", "postgres-repository.js");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(file) {
  assert(fs.existsSync(file), `文件不存在：${path.relative(root, file)}`);
  return fs.readFileSync(file, "utf8");
}

function main() {
  const migration = read(postgresMigration);
  const deployment = read(deploymentDoc);
  const databasePlan = read(databaseDoc);
  const env = read(envExample);
  const exporter = read(exportScript);
  const runtimeChecker = read(runtimeScript);
  const adapterChecker = read(adapterScript);
  const postgresAdapter = read(adapterFile);
  const repositoryChecker = read(repositoryScript);
  const contract = read(repositoryContract);
  const sqliteRepo = read(sqliteRepository);
  const postgresRepo = read(postgresRepository);

  assert(migration.includes("JSONB"), "PostgreSQL 迁移缺少 JSONB 字段");
  assert(migration.includes("TIMESTAMPTZ"), "PostgreSQL 迁移缺少时区时间字段");
  assert(migration.includes("REFERENCES users"), "PostgreSQL 迁移缺少外键约束");
  assert(migration.includes("password_hash"), "PostgreSQL 迁移缺少密码哈希字段");
  assert(migration.includes("DEFERRABLE INITIALLY DEFERRED"), "PostgreSQL 迁移缺少延迟外键约束");
  assert(migration.includes("idx_messages_channel_parent_id"), "PostgreSQL 迁移缺少消息查询索引");
  assert(env.includes("BEECHAT_DB_PROVIDER=sqlite"), "生产环境变量样例缺少数据库类型");
  assert(env.includes("BEECHAT_DATABASE_URL="), "生产环境变量样例缺少 PostgreSQL 连接串");
  assert(deployment.includes("PostgreSQL 适配计划"), "部署文档缺少 PostgreSQL 章节");
  assert(databasePlan.includes("SQLite 到 PostgreSQL 迁移路径"), "数据库规划缺少迁移路径");
  assert(databasePlan.includes("npm run db:export:postgres"), "数据库规划缺少 PostgreSQL 导出命令");
  assert(databasePlan.includes("npm run db:runtime:check"), "数据库规划缺少运行模式检查命令");
  assert(databasePlan.includes("不迁移活动会话"), "数据库规划缺少会话迁移安全说明");
  assert(databasePlan.includes("回滚策略"), "数据库规划缺少回滚策略");
  assert(exporter.includes("INSERT INTO messages"), "PostgreSQL 导出脚本缺少消息导入逻辑");
  assert(exporter.includes("TRUNCATE unread_state"), "PostgreSQL 导出脚本缺少清理顺序");
  assert(exporter.includes("sanitizedStoreSnapshot"), "PostgreSQL 导出脚本缺少快照脱敏逻辑");
  assert(runtimeChecker.includes("PostgreSQL 模式缺少 BEECHAT_DATABASE_URL"), "数据库运行模式检查缺少连接串校验");
  assert(runtimeChecker.includes("PostgreSQL 运行适配层尚未启用"), "数据库运行模式检查缺少未启用提示校验");
  assert(adapterChecker.includes("BeeChat PostgreSQL 查询适配层检查通过"), "PostgreSQL 适配层检查脚本缺少成功提示");
  assert(postgresAdapter.includes("class PostgresAdapter"), "PostgreSQL 适配层缺少类定义");
  assert(postgresAdapter.includes("async transaction"), "PostgreSQL 适配层缺少事务封装");
  assert(postgresAdapter.includes("async runMigrations"), "PostgreSQL 适配层缺少迁移执行封装");
  assert(repositoryChecker.includes("BeeChat 仓储契约检查通过"), "仓储契约检查脚本缺少成功提示");
  assert(contract.includes("REQUIRED_METHODS"), "仓储契约缺少方法清单");
  assert(sqliteRepo.includes("class SQLiteRepository"), "SQLite 仓储缺少类定义");
  assert(postgresRepo.includes("class PostgresRepository"), "PostgreSQL 仓储缺少类定义");

  console.log("BeeChat PostgreSQL 适配计划检查通过");
}

main();
