import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { env } from '$env/dynamic/private';
import { getDatabasePath } from '$lib/server/db/path';
import * as schema from '$lib/server/db/schema';

const client = new Database(getDatabasePath(env.DATA_DIR));

export const db = drizzle(client, { schema });
