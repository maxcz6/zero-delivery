const fs = require("fs");
const path = require("path");
const re = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F\u200D]/gu;
const roots = ["zero-delivery/apps/web/src", "zero-delivery/apps/web/tests", "zero-delivery/apps/api/src", "zero-delivery/packages/shared-types/src", "zero-delivery/scripts"];
function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.next|dist/.test(p)) walk(p, out); }
    else if (/\.(tsx?|mjs|css|json|md|sql)$/.test(p)) out.push(p);
  }
}
const files = [];
for (const r of roots) walk(r, files);
let total = 0;
for (const f of files) {
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    const m = line.match(re);
    if (m) { total += m.length; console.log(`${f}:${i + 1} [${[...new Set(m)].join(" ")}] ${line.trim().slice(0, 130)}`); }
  });
}
console.log("TOTAL EMOJIS:", total);
