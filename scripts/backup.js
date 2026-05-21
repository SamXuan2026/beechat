const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const uploadDir = path.join(dataDir, "uploads");
const backupRoot = path.join(rootDir, "backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(backupRoot, `beechat-${timestamp}`);

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function copyFileIfExists(source, target) {
  if (!fs.existsSync(source)) return false;
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
  return true;
}

function listFiles(directory, base = directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).flatMap((name) => {
    const current = path.join(directory, name);
    const stat = fs.statSync(current);
    if (stat.isDirectory()) return listFiles(current, base);
    return [{
      path: path.relative(base, current),
      size: stat.size,
      updatedAt: stat.mtime.toISOString()
    }];
  });
}

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) return;
  ensureDir(target);
  fs.readdirSync(source).forEach((name) => {
    const currentSource = path.join(source, name);
    const currentTarget = path.join(target, name);
    const stat = fs.statSync(currentSource);
    if (stat.isDirectory()) {
      copyDirectory(currentSource, currentTarget);
      return;
    }
    fs.copyFileSync(currentSource, currentTarget);
  });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  ensureDir(backupDir);
  const copied = {
    sqlite: copyFileIfExists(path.join(dataDir, "beechat.sqlite"), path.join(backupDir, "beechat.sqlite")),
    snapshot: copyFileIfExists(path.join(dataDir, "store.json"), path.join(backupDir, "store.json"))
  };
  copyDirectory(uploadDir, path.join(backupDir, "uploads"));

  const manifest = {
    project: "bee-chat",
    createdAt: new Date().toISOString(),
    backupDir,
    copied,
    uploads: listFiles(uploadDir)
  };
  writeJson(path.join(backupDir, "manifest.json"), manifest);
  console.log(`BeeChat 备份完成：${backupDir}`);
}

main();
