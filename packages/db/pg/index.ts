import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "./generated/prisma/client.js";

// Newer `pg` versions treat `sslmode=require` as `verify-full`, which fails
// against managed providers (e.g. Tiger Cloud) whose CA isn't in the local
// trust store. Strip `sslmode` from the URL and configure TLS explicitly:
// encrypt the connection but don't verify the CA (matches libpq `require`).
const rawUrl = process.env.DATABASE_URL ?? "";
const useSsl = /[?&]sslmode=(?!disable)/i.test(rawUrl);
const connectionString = rawUrl
  .replace(/([?&])sslmode=[^&]*/gi, "$1")
  .replace(/[?&]+$/g, "");

const prismaPgAdapter = new PrismaPg({
  connectionString,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

const prismaClient: PrismaClient = new PrismaClient({ adapter: prismaPgAdapter });
export { prismaClient, Prisma };
export type { PrismaClient } from "./generated/prisma/client.js";
