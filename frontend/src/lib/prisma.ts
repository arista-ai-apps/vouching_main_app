import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  if (url && token) {
    console.log('[DB] Connecting to Turso:', url);
    const libsql = createClient({ url, authToken: token });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter } as any);
  }

  console.warn('[DB] WARNING: TURSO_DATABASE_URL not set — using local SQLite');
  return new PrismaClient();
}

// Always create fresh to pick up env vars — globalThis is only stable across hot-reloads
// if it was initialized with the right env vars the first time.
if (!global._prisma) {
  global._prisma = createPrismaClient();
}

export const prisma = global._prisma;
