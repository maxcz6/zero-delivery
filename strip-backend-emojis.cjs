const fs = require("fs");
const files = [
  "zero-delivery/apps/api/src/modules/integrations/vocero/outbox-processor.service.ts",
  "zero-delivery/apps/api/src/modules/integrations/vocero/vocero-bot.service.ts",
];
const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F\u200D]/gu;
for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  const before = (s.match(emoji) || []).length;
  s = s.replace(emoji, "");
  s = s.replace(/ {2,}/g, " ");
  s = s.replace(/ ([.,;:!?])/g, "$1");
  s = s.replace(/^ /gm, "");
  fs.writeFileSync(f, s, "utf8");
  const after = (s.match(emoji) || []).length;
  console.log(f.split("/").pop(), "antes:", before, "despues:", after);
}
