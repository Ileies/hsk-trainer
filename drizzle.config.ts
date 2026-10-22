import { defineConfig } from 'drizzle-kit';
import { getDatabasePath } from './src/lib/server/db/path';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: getDatabasePath() },
	verbose: true,
	strict: true
});
