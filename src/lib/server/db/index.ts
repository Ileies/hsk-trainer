import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { DATA_DIR } from '$app/env/private';
import { getDatabasePath } from '#lib/server/db/path.js';
import * as schema from '#lib/server/db/schema.js';

const client = new Database(getDatabasePath(DATA_DIR));

export const db = drizzle(client, { schema });
