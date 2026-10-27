// Một lệnh dựng môi trường local: .env (kèm APP_SECRET ngẫu nhiên) → Postgres (Docker) → schema → dữ liệu mẫu.
// Chỉ nạp dữ liệu khi DB còn trống — chạy lại nhiều lần không mất số liệu.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, readFileSync } from "node:fs";

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Đã tạo .env từ .env.example");
}
if (!/^APP_SECRET=.{32,}$/m.test(readFileSync(".env", "utf8"))) {
  appendFileSync(".env", `\n# Khoá ký phiên đăng nhập + băm mã đón — sinh ngẫu nhiên, không chia sẻ\nAPP_SECRET=${randomBytes(32).toString("hex")}\n`);
  console.log("Đã sinh APP_SECRET trong .env");
}
process.loadEnvFile(".env");

run("docker compose up -d --wait");
run("npm run db:push");
run("npx tsx prisma/seed.ts --if-empty");
console.log(`\nXong. Chạy app: npm run dev, rồi mở http://localhost:${process.env.PORT}`);
