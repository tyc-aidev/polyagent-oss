import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

export function createPrismaClient(connectionString: string): PrismaClient {
  const pool = new Pool({ connectionString, maxUses: 1 });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}