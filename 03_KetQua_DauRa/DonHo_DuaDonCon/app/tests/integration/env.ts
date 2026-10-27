// Chạy trước mỗi file integration: trỏ Prisma sang DB test trước khi src/server/db.ts được import.
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
