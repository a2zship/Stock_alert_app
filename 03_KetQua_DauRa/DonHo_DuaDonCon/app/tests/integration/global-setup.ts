// Đồng bộ schema lên DB TEST (không bao giờ đụng DB thật) trước khi chạy integration test.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

export default function setup() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("Thiếu DATABASE_URL_TEST trong .env");
  if (url === process.env.DATABASE_URL) throw new Error("DATABASE_URL_TEST trùng DATABASE_URL — từ chối chạy test trên DB thật.");
  if (!/\/[^/?]+_test(\?|$)/.test(url)) throw new Error("DATABASE_URL_TEST phải trỏ tới database tên *_test.");
  execSync("npx prisma db push --skip-generate", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
}
