const fs = require("fs");
const path = require("path");

function loadPgModule() {
  try {
    return require("pg");
  } catch (error) {
    const next = new Error("缺少 PostgreSQL 驱动 pg，请先完成依赖安装后再启用 postgres 运行模式");
    next.cause = error;
    throw next;
  }
}

function assertDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error("PostgreSQL 连接串不能为空");
  }
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error("PostgreSQL 连接串格式无效");
  }
}

function normalizeMigrationFile(file) {
  const match = /^(\d+)_([a-zA-Z0-9_-]+)\.sql$/.exec(file);
  if (!match) return null;
  return {
    version: match[1],
    name: file
  };
}

class PostgresAdapter {
  constructor(options = {}) {
    assertDatabaseUrl(options.databaseUrl);
    this.databaseUrl = options.databaseUrl;
    this.migrationsDir = options.migrationsDir || path.join(__dirname, "..", "..", "migrations", "postgres");
    this.pool = null;
  }

  connect() {
    if (this.pool) return this.pool;
    const { Pool } = loadPgModule();
    this.pool = new Pool({
      connectionString: this.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    return this.pool;
  }

  async close() {
    if (!this.pool) return;
    await this.pool.end();
    this.pool = null;
  }

  async query(sql, params = []) {
    const pool = this.connect();
    return pool.query(sql, params);
  }

  async transaction(handler) {
    const pool = this.connect();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await handler(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async health() {
    const result = await this.query("SELECT now() AS time");
    return {
      provider: "postgres",
      status: "UP",
      time: result.rows[0].time
    };
  }

  async ensureMigrationTable() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  async migrationStatus() {
    await this.ensureMigrationTable();
    const result = await this.query("SELECT version, name, applied_at AS \"appliedAt\" FROM schema_migrations ORDER BY version ASC");
    return result.rows;
  }

  async runMigrations() {
    await this.ensureMigrationTable();
    if (!fs.existsSync(this.migrationsDir)) return [];
    const applied = new Set((await this.migrationStatus()).map((item) => item.version));
    const files = fs.readdirSync(this.migrationsDir)
      .map(normalizeMigrationFile)
      .filter(Boolean)
      .sort((left, right) => left.version.localeCompare(right.version));
    const appliedNow = [];

    for (const file of files) {
      if (applied.has(file.version)) continue;
      const sql = fs.readFileSync(path.join(this.migrationsDir, file.name), "utf8").trim();
      if (!sql) continue;
      await this.transaction(async (client) => {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations(version, name, applied_at) VALUES ($1, $2, now())",
          [file.version, file.name]
        );
      });
      appliedNow.push(file);
    }

    return appliedNow;
  }
}

function createPostgresAdapter(options) {
  return new PostgresAdapter(options);
}

module.exports = {
  PostgresAdapter,
  createPostgresAdapter,
  assertDatabaseUrl,
  normalizeMigrationFile
};
