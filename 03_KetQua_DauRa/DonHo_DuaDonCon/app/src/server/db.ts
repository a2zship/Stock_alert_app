import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;

/** Lỗi nghiệp vụ: thông điệp hiển thị thẳng cho người dùng. */
export class AppError extends Error {}

export function appSecret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 32) throw new Error("Thiếu APP_SECRET trong .env — chạy `npm run setup`.");
  return s;
}

export function publicUrl(): string {
  return (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT ?? 3271}`).replace(/\/$/, "");
}
