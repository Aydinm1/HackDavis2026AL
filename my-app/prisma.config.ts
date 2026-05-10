import "dotenv/config";
import { defineConfig } from "prisma/config";

const pooledUrl = process.env["DATABASE_URL"] ?? "postgresql://user:password@localhost:5432/testdb?schema=public";
// Neon pooled endpoints can't acquire advisory locks needed by prisma migrate.
// Strip "-pooler" from the hostname to get the direct connection for migrations.
const directUrl = process.env["DIRECT_DATABASE_URL"] ?? pooledUrl.replace(/-pooler(\.[^/]+\.aws\.neon\.tech)/, "$1");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl,
  },
});
