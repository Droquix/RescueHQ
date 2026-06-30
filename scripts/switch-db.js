const fs = require('fs');
const path = require('path');

const target = process.argv[2];

if (target !== 'sqlite' && target !== 'postgresql') {
  console.error('Usage: node scripts/switch-db.js [sqlite|postgresql]');
  process.exit(1);
}

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const dbLibPath = path.join(__dirname, '../src/lib/db.ts');

// Helper to modify schema.prisma
function updateSchema(provider) {
  let content = fs.readFileSync(schemaPath, 'utf8');
  
  // Replace provider inside datasource db
  const dbBlockRegex = /(datasource\s+db\s*{[^}]*provider\s*=\s*")[^"]*("[^}]*})/g;
  content = content.replace(dbBlockRegex, `$1${provider}$2`);
  
  fs.writeFileSync(schemaPath, content, 'utf8');
  console.log(`Updated schema.prisma datasource provider to: ${provider}`);
}

// Helper to modify src/lib/db.ts
function updateDbLib(provider) {
  let content = '';

  if (provider === 'sqlite') {
    content = `import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import path from "node:path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function getDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl?.startsWith("file:")) {
    const relative = envUrl.replace("file:", "");
    const absolute = path.isAbsolute(relative)
      ? relative
      : path.join(process.cwd(), relative.replace(/^\.\\//, ""));
    return \`file:\${absolute}\`;
  }
  return \`file:\${path.join(process.cwd(), "dev.db")}\`;
}

function createClient() {
  const adapter = new PrismaBetterSqlite3({ url: getDatabaseUrl() });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
`;
  } else if (provider === 'postgresql') {
    content = `import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
`;
  }

  fs.writeFileSync(dbLibPath, content, 'utf8');
  console.log(`Updated src/lib/db.ts for database provider: ${provider}`);
}

updateSchema(target);
updateDbLib(target);
console.log(`Successfully configured project for ${target}! Run 'npm run build' or regenerate client to apply.`);
