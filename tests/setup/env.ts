import { existsSync } from "node:fs";

// Next.js skips .env.local when NODE_ENV=test, so load it directly: tests use the app's keys.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
