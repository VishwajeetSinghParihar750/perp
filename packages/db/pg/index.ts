import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "./generated/prisma/client.js";

const prismaPgAdapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prismaClient = new PrismaClient({ adapter: prismaPgAdapter });
export { prismaClient, Prisma };
