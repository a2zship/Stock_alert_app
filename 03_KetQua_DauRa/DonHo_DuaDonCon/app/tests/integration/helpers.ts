import { db } from "@/server/db";
import { seed } from "../../prisma/seed";
import { avatarPng } from "../../prisma/avatar";

/** Xoá sạch DB test rồi nạp lại dữ liệu mẫu. Có chốt tên DB *_test để không bao giờ xoá nhầm DB thật. */
export async function resetDb() {
  const [{ current_database }] = await db.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
  if (!current_database.endsWith("_test")) throw new Error(`Từ chối xoá DB "${current_database}" (không phải *_test)`);
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await seed(db);
}

export const phoneOf = {
  bo: "0901000001", me: "0901000002", meBinh: "0901000003", coLan: "0901000010", coMai: "0901000011", baNgoai: "0901000020", bao: "0901000004",
};

export async function uid(phone: string) {
  return (await db.user.findUniqueOrThrow({ where: { phone } })).id;
}

export async function beAn() {
  return db.student.findFirstOrThrow({ where: { name: "Lê Minh An" } });
}

export const photoDataUrl = () => `data:image/png;base64,${avatarPng([10, 120, 80], 32).toString("base64")}`;
