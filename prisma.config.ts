import { config } from "dotenv"
import { defineConfig } from "prisma/config"

config({ path: ".env.local" })
config()

const migrationUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/massagelab"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
})
