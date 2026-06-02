import { $ } from 'bun';

const REMOTE_DIR = `/var/www/hsk-trainer`;

try {
	// Compress build directory
	console.log('Compressing build directory...');
	await $`tar -czf ./build.tar.gz -C ./build . -C .. .env`;

	// Upload compressed build
	console.log('Uploading compressed build...');
	await $`scp ./build.tar.gz ros:/tmp/build.tar.gz`;

	// Clean remote directory (preserving data folder, db, and env)
	console.log('Cleaning remote directory...');
	await $`ssh ros "find ${REMOTE_DIR} -mindepth 1 -maxdepth 1 ! -name 'local.db' ! -name 'pm2.config.cjs' -exec rm -rf {} +"`;

	// Extract build on server
	console.log('Extracting build on server...');
	await $`ssh ros "tar -xzf /tmp/build.tar.gz -C ${REMOTE_DIR}"`;

	// Clean up temporary file
	console.log('Cleaning up temporary files...');
	await $`ssh ros "rm /tmp/build.tar.gz"`;
	await $`rm ./build.tar.gz`;

	// Restart application
	console.log('Restarting application...');
	await $`ssh ros "pm2 restart hsk-trainer"`;

	console.log('Deployment completed successfully!');
} catch (error) {
	console.error('Deployment failed:', error instanceof Error ? error.message : String(error));
	process.exit(1);
}
