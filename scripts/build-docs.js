const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STYLE_FILE = path.join(ROOT, "docs", "assets", "docs.css");
const STYLE_VERSION = "tailwind-20260513";
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "data"]);

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (name.endsWith(".md")) files.push(fullPath);
  }
  return files;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inlineMarkdown(value, sourceFile) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const target = href.endsWith(".md") ? href.replace(/\.md(#.*)?$/, ".html$1") : href;
      return `<a href="${escapeHtml(target)}">${label}</a>`;
    });
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((item) => item.trim());
}

function renderTable(lines, start, sourceFile) {
  const header = splitTableRow(lines[start]);
  let index = start + 2;
  const rows = [];
  while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }
  const thead = `<thead><tr>${header.map((cell) => `<th>${inlineMarkdown(cell, sourceFile)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell, sourceFile)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return { html: `<table>${thead}${tbody}</table>`, next: index };
}

function flushParagraph(buffer, parts, sourceFile) {
  if (!buffer.length) return;
  parts.push(`<p>${inlineMarkdown(buffer.join(" "), sourceFile)}</p>`);
  buffer.length = 0;
}

function renderMarkdown(markdown, sourceFile) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const parts = [];
  const paragraph = [];
  let index = 0;
  let inCode = false;
  let codeLang = "";
  let code = [];

  while (index < lines.length) {
    const line = lines[index];

    if (line.startsWith("```")) {
      if (inCode) {
        parts.push(`<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(code.join("\n"))}</code></pre>`);
        inCode = false;
        codeLang = "";
        code = [];
      } else {
        flushParagraph(paragraph, parts, sourceFile);
        inCode = true;
        codeLang = line.slice(3).trim();
      }
      index += 1;
      continue;
    }

    if (inCode) {
      code.push(line);
      index += 1;
      continue;
    }

    if (!line.trim()) {
      flushParagraph(paragraph, parts, sourceFile);
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && lines[index].includes("|") && isTableDivider(lines[index + 1])) {
      flushParagraph(paragraph, parts, sourceFile);
      const table = renderTable(lines, index, sourceFile);
      parts.push(table.html);
      index = table.next;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph(paragraph, parts, sourceFile);
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slug(text);
      parts.push(`<h${level} id="${escapeHtml(id)}">${inlineMarkdown(text, sourceFile)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph(paragraph, parts, sourceFile);
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      parts.push(`<ul>${items.map((item) => `<li>${inlineMarkdown(item, sourceFile)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph(paragraph, parts, sourceFile);
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      parts.push(`<ol>${items.map((item) => `<li>${inlineMarkdown(item, sourceFile)}</li>`).join("")}</ol>`);
      continue;
    }

    if (/^\s*>/.test(line)) {
      flushParagraph(paragraph, parts, sourceFile);
      const quotes = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quotes.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      parts.push(`<blockquote>${quotes.map((item) => `<p>${inlineMarkdown(item, sourceFile)}</p>`).join("")}</blockquote>`);
      continue;
    }

    paragraph.push(line.trim());
    index += 1;
  }

  flushParagraph(paragraph, parts, sourceFile);
  return parts.join("\n");
}

function titleFrom(markdown, filePath) {
  const match = /^#\s+(.+)$/m.exec(markdown);
  if (match) return match[1].trim();
  return path.basename(filePath, ".md");
}

function relativeHtmlPath(fromFile, toFile) {
  return path.relative(path.dirname(fromFile), toFile.replace(/\.md$/, ".html")).replace(/\\/g, "/");
}

function navHtml(currentHtml, docs) {
  return docs
    .map((doc) => {
      const href = relativeHtmlPath(currentHtml, doc.file);
      const active = currentHtml === doc.html ? " active" : "";
      return `<a class="doc-nav-link${active}" href="${escapeHtml(href)}"><span>${escapeHtml(doc.section)}</span>${escapeHtml(doc.title)}</a>`;
    })
    .join("\n");
}

function sectionName(filePath) {
  const relative = path.relative(ROOT, filePath).replace(/\\/g, "/");
  if (relative.startsWith("docs/beechat/")) return "BeeChat";
  if (relative.startsWith("docs/beepilot/references/")) return "BeePilot 参考";
  if (relative.startsWith("docs/beepilot/")) return "BeePilot";
  if (relative.startsWith("design/")) return "设计";
  return "项目";
}

function buildPage(doc, docs) {
  const markdown = fs.readFileSync(doc.file, "utf8");
  const cssPath = `${path.relative(path.dirname(doc.html), STYLE_FILE).replace(/\\/g, "/")}?v=${STYLE_VERSION}`;
  const body = renderMarkdown(markdown, doc.file);
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(doc.title)}</title>
    <link rel="stylesheet" href="${escapeHtml(cssPath)}" />
  </head>
  <body>
    <div class="doc-shell">
      <aside class="doc-sidebar">
        <div class="doc-brand">
          <strong>BeeChat Docs</strong>
          <span>HTML 文档中心</span>
        </div>
        <nav>${navHtml(doc.html, docs)}</nav>
      </aside>
      <main class="doc-main">
        <article class="doc-article">
          <div class="doc-meta">
            <span>${escapeHtml(doc.section)}</span>
            <span>离线 HTML · Tailwind CSS</span>
          </div>
          ${body}
        </article>
      </main>
    </div>
  </body>
</html>
`;
}

function main() {
  const mdFiles = walk(ROOT)
    .filter((file) => !file.includes(`${path.sep}frontend${path.sep}dist${path.sep}`))
    .sort((a, b) => path.relative(ROOT, a).localeCompare(path.relative(ROOT, b)));
  const docs = mdFiles.map((file) => {
    const markdown = fs.readFileSync(file, "utf8");
    return {
      file,
      html: file.replace(/\.md$/, ".html"),
      section: sectionName(file),
      title: titleFrom(markdown, file)
    };
  });

  for (const doc of docs) {
    fs.writeFileSync(doc.html, buildPage(doc, docs));
  }

  console.log(`已生成 ${docs.length} 个 HTML 文档`);
}

main();
