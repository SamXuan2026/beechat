const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");

function read(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`缺少文件：${relativePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function assertIncludes(content, keyword, message) {
  if (!content.includes(keyword)) throw new Error(message);
}

function main() {
  const dockerfile = read("Dockerfile");
  const compose = read("docker-compose.prod.yml");
  const envExample = read(".env.prod.example");
  const nginx = read("deploy/nginx/beechat.conf");

  assertIncludes(dockerfile, "AS frontend-builder", "Dockerfile 缺少前端构建阶段");
  assertIncludes(dockerfile, "COPY --from=frontend-builder", "Dockerfile 未复制前端构建产物");
  assertIncludes(dockerfile, "HEALTHCHECK", "Dockerfile 缺少健康检查");
  assertIncludes(compose, "services:", "生产 Compose 文件头异常");
  assertIncludes(compose, "healthcheck:", "生产 Compose 缺少健康检查");
  assertIncludes(compose, "./data:/app/data", "生产 Compose 缺少数据卷");
  assertIncludes(compose, "./logs:/app/logs", "生产 Compose 缺少日志卷");
  assertIncludes(compose, "./backups:/app/backups", "生产 Compose 缺少备份卷");
  assertIncludes(envExample, "BEECHAT_BIND=", "生产环境变量样例缺少绑定地址");
  assertIncludes(nginx, "location /api/realtime", "Nginx 样例缺少 WebSocket 代理");
  assertIncludes(nginx, "proxy_set_header Upgrade", "Nginx 样例缺少升级头");

  console.log("BeeChat 生产部署配置检查通过");
}

main();
