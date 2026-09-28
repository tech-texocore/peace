import { resolve } from "path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: resolve(process.cwd(), `../.env.${process.env.NODE_ENV ?? "development"}`), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node scripts/seed.js",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
