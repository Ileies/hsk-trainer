import { randomBytes, randomInt } from 'crypto';

export const SESSION_COOKIE = 'session';
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const TOKEN_DURATION_MS = 15 * 60 * 1000;

export function generateToken(): string {
	return randomBytes(32).toString('hex');
}

export function generatePin(): string {
	return randomInt(100000, 1000000).toString();
}
