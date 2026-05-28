import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".next", ".git", "scripts", ".vercel"]);

// All patterns use \uXXXX — 100% ASCII source.
// 2-byte UTF-8 (0xCn lead): each byte becomes a cp1252 char.
// 3-byte UTF-8 (0xE2 0x80 0xNN): becomes U+00E2 + U+20AC + cp1252[0xNN].
const FIXES = [
  [/Ã¡/g, "á"],  // á  (C3 A1)
  [/Ã©/g, "é"],  // é  (C3 A9)
  [/Ã­/g, "í"],  // í  (C3 AD)
  [/Ã³/g, "ó"],  // ó  (C3 B3)
  [/Ãº/g, "ú"],  // ú  (C3 BA)
  [/Ã±/g, "ñ"],  // ñ  (C3 B1)
  [/Ã¼/g, "ü"],  // ü  (C3 BC)
  [/Ãš/g, "Ú"],  // Ú  (C3 9A; 0x9A cp1252 = U+0161 scaron)
  [/Ã‘/g, "Ñ"],  // Ñ  (C3 91; 0x91 cp1252 = U+2018 lsquo)
  [/Â«/g, "«"],  // «  (C2 AB)
  [/Â»/g, "»"],  // »  (C2 BB)
  [/Â·/g, "·"],  // ·  (C2 B7)
  [/Â¡/g, "¡"],  // ¡  (C2 A1)
  [/Â¿/g, "¿"],  // ¿  (C2 BF)
  // 3-byte: E2 80 94 => em dash  (0x94 cp1252 = U+201D)
  [/â€”/g, "—"],
  // 3-byte: E2 80 93 => en dash  (0x93 cp1252 = U+201C)
  [/â€“/g, "–"],
  // 3-byte: E2 80 A6 => ellipsis (0xA6 Latin-1 = U+00A6)
  [/â€¦/g, "…"],
  // 3-byte: E2 80 99 => right-single-quote (0x99 cp1252 = U+2122 TM)
  [/â€™/g, "’"],
  // 3-byte: E2 80 9C => left-double-quote  (0x9C cp1252 = U+0153 oe)
  [/â€œ/g, "“"],
  // 3-byte: E2 88 92 => minus sign U+2212 (0x88 cp1252 = U+02C6, 0x92 = U+2019)
  [new RegExp("âˆ’", "g"), "−"],
  // 3-byte: E2 94 80 => box-drawing light horizontal U+2500 (0x94 cp1252 = U+201D, 0x80 = U+20AC)
  [new RegExp("â”€", "g"), "─"],
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

let fixed = 0;
for (const f of walk(ROOT)) {
  const orig = fs.readFileSync(f, "utf8");
  let text = orig;
  for (const [re, rep] of FIXES) text = text.replace(re, rep);
  if (text !== orig) {
    fs.writeFileSync(f, text, "utf8");
    console.log("  fixed:", path.relative(ROOT, f));
    fixed++;
  }
}
console.log(`\nDone. ${fixed} file(s) corrected.`);
