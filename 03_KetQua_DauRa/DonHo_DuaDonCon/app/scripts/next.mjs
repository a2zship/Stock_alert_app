// Chạy `next dev|start` với cổng lấy từ .env (PORT) — không hardcode cổng.
// Next không đọc PORT trong .env vì server khởi động trước khi nạp .env, nên nạp ở đây.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

if (existsSync(".env")) process.loadEnvFile(".env");

const mode = process.argv[2] ?? "dev";
const port = process.env.PORT;
if (!port) {
  console.error("Thiếu PORT trong .env — copy .env.example thành .env (hoặc chạy `npm run setup`).");
  process.exit(1);
}

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
// HOST=127.0.0.1 (mặc định): chỉ máy này truy cập trực tiếp; điện thoại vào qua `tailscale serve` (HTTPS).
const host = process.env.HOST || "127.0.0.1";
const child = spawn(process.execPath, [nextBin, mode, "-p", port, "-H", host], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
