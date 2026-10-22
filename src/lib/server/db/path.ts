import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function getDatabasePath(dataDir = process.env.DATA_DIR): string {
	const directory = resolve(dataDir || './data');
	mkdirSync(directory, { recursive: true });
	return join(directory, 'local.db');
}
