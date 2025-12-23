import { defineConfig } from 'drizzle-kit';

// Определяем окружение: prod по умолчанию, dev если указан CLOUDFLARE_ENV=dev
const isProd = process.env.CLOUDFLARE_ENV !== 'dev';

// Database IDs из wrangler.jsonc
const DATABASE_ID = isProd 
  ? '032b9b85-80ed-456b-91d7-66be4b4422fe' // prod
  : '77fcc790-099b-4d01-aa83-b318d43754e4'; // dev

export default defineConfig({
  schema: './worker/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: DATABASE_ID,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
});
