// The database client: Supabase Postgres through the transaction pooler (DATABASE_URL), with
// Prisma 7's node-postgres driver adapter.
import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "./env.js";
import { PrismaClient } from "./generated/prisma/client.js";

export function createPrisma() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
