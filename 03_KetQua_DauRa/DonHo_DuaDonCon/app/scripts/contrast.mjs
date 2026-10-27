// node scripts/contrast.mjs — đo tương phản WCAG cho các cặp token, đọc thẳng từ src/app/globals.css (sáng + tối).
// Chữ thường cần ≥ 4.5; viền ô nhập / thành phần giao diện cần ≥ 3. Thoát mã 1 nếu có cặp không đạt.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const block = (re) => Object.fromEntries([...(css.match(re)?.[1] ?? "").matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const light = block(/:root \{([\s\S]*?)\n\}/);
const dark = { ...light, ...block(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\n {2}\}/) };

const lin = (h) => h.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
const L = (h) => { const [r, g, b] = lin(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [chữ, nền, ngưỡng]
const PAIRS = [
  ["text", "surface", 4.5], ["text", "bg", 4.5], ["text-2", "surface-2", 4.5], ["muted", "surface", 4.5], ["muted", "bg", 4.5], ["muted", "surface-2", 4.5],
  ["primary", "surface", 4.5], ["primary", "primary-soft", 4.5], ["on-primary", "primary", 4.5], ["primary-hover", "primary-tint", 4.5],
  ["ok", "surface", 4.5], ["ok", "ok-soft", 4.5], ["surface", "ok", 4.5],
  ["danger", "surface", 4.5], ["danger", "danger-soft", 4.5], ["on-danger", "danger", 4.5], ["surface", "danger", 4.5],
  ["warn", "surface", 4.5], ["warn", "warn-soft", 4.5], ["info", "info-soft", 4.5],
  ["accent", "surface", 4.5], ["accent", "accent-soft", 4.5], ["accent", "accent-tint", 4.5], ["surface", "accent", 4.5],
  ["on-hero", "hero-from", 4.5], ["on-hero", "hero-to", 4.5], ["on-hero-2", "hero-to", 4.5], ["hero-from", "surface", 4.5, "SÁNG"], // tối: nút trong khối chào dùng on-primary/primary (đã đo ở trên)
  ["nav-text", "nav-bg", 4.5], ["brand", "nav-bg", 4.5],
  ["border-strong", "surface", 3], ["map-school", "surface", 3], ["map-person", "surface", 3], ["map-home", "surface", 3], ["surface", "map-home", 3],
];

let fail = 0;
for (const [mode, t] of [["SÁNG", light], ["TỐI", dark]]) {
  console.log(`== ${mode}`);
  for (const [f, b, min, only] of PAIRS) {
    if (only && only !== mode) continue;
    if (!t[f] || !t[b]) { console.log(`   ?    ${f} / ${b} — thiếu token`); continue; }
    const v = cr(t[f], t[b]);
    const ok = v >= min;
    if (!ok) fail++;
    console.log(`${ok ? "  " : "✗ "}${v.toFixed(2).padStart(6)}  ${f} (${t[f]}) / ${b} (${t[b]})${min === 3 ? "  [≥3]" : ""}`);
  }
}
console.log(fail ? `\n${fail} cặp KHÔNG ĐẠT` : "\nTất cả các cặp đạt ngưỡng.");
process.exit(fail ? 1 : 0);
