import { $ } from 'bun';
import { copyFile, cp } from 'node:fs/promises';

const REMOTE_HOST = 'ros';
const REMOTE_DIR = '/var/www/hsk-trainer';
const SERVICE = 'hsk-trainer.service';

try {
	if (!(await Bun.file('build/index.js').exists())) {
		throw new Error('Build output is missing. Run bun run build before deploying.');
	}

	console.log('Installing production dependencies in build/...');
	await copyFile('package.json', 'build/package.json');
	await copyFile('bun.lock', 'build/bun.lock');
	await cp('patches', 'build/patches', { recursive: true });
	// The prepare script needs development tools, which are unnecessary in the built server.
	await $`bun install --production --frozen-lockfile --ignore-scripts`.cwd('build');

	console.log('Syncing build to server...');
	await $`rsync -az --delete --exclude=/.env ${'--exclude=/local.db*'} --exclude=/data/ ./build/ ${REMOTE_HOST}:${REMOTE_DIR}/`;

	console.log('Restarting systemd service...');
	await $`ssh ${REMOTE_HOST} systemctl restart ${SERVICE}`;
	await $`ssh ${REMOTE_HOST} systemctl is-active --quiet ${SERVICE}`;

	console.log('Deployment completed successfully!');
} catch (error) {
	console.error('Deployment failed:', error instanceof Error ? error.message : String(error));
	process.exit(1);
}
