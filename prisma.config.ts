import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Prisma 7 reads the seed command from here, not from package.json.
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
