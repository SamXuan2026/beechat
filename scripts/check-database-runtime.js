const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const serverFile = path.join(root, "server", "index.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runWithEnv(env) {
  const result = spawnSync(process.execPath, [serverFile], {
    cwd: root,
    env: {
      ...process.env,
      ...env,
      PORT: "5199"
    },
    encoding: "utf8",
    timeout: 3000
  });
  return {
    code: result.status,
    output: `${result.stdout || ""}\n${result.stderr || ""}`
  };
}

function main() {
  const missingUrl = runWithEnv({
    BEECHAT_DB_PROVIDER: "postgres",
    BEECHAT_DATABASE_URL: ""
  });
  assert(missingUrl.code !== 0, "PostgreSQL 缺少连接串时不应启动");
  assert(missingUrl.output.includes("PostgreSQL 模式缺少 BEECHAT_DATABASE_URL"), "缺少连接串错误提示异常");

  const unsupported = runWithEnv({
    BEECHAT_DB_PROVIDER: "mysql",
    BEECHAT_DATABASE_URL: ""
  });
  assert(unsupported.code !== 0, "不支持的数据库类型不应启动");
  assert(unsupported.output.includes("数据库类型不支持"), "不支持数据库错误提示异常");

  const postgresPending = runWithEnv({
    BEECHAT_DB_PROVIDER: "postgres",
    BEECHAT_DATABASE_URL: "postgres://beechat:password@127.0.0.1:5432/beechat"
  });
  assert(postgresPending.code !== 0, "PostgreSQL 适配层未启用前不应启动");
  assert(postgresPending.output.includes("PostgreSQL 运行适配层尚未启用"), "PostgreSQL 未启用提示异常");

  console.log("BeeChat 数据库运行模式检查通过");
}

main();
