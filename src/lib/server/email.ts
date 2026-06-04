import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

export async function sendMagicLink(toEmail: string, token: string, pin: string, origin: string) {
	const transporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: parseInt(env.SMTP_PORT ?? '587'),
		secure: env.SMTP_SECURE === 'true',
		auth: env.SMTP_USER
			? {
					user: env.SMTP_USER,
					pass: env.SMTP_PASS
				}
			: undefined
	});

	const url = `${origin}/auth/verify?token=${token}`;

	await transporter.sendMail({
		from: env.SMTP_FROM ?? `noreply@${new URL(origin).hostname}`,
		to: toEmail,
		subject: 'Sign in to HSK Trainer',
		text: `Your sign-in PIN is: ${pin}\n\nOr click this link to sign in directly:\n${url}\n\nBoth expire in 15 minutes.`,
		html: `
<p style="font-size:1.1em">Your sign-in PIN:</p>
<p style="font-size:2.5em;font-weight:bold;letter-spacing:0.2em;font-family:monospace">${pin}</p>
<p>Or <a href="${url}">click here to sign in</a> directly.</p>
<p style="color:#888;font-size:0.85em">Both expire in 15 minutes. If you didn't request this, ignore this email.</p>`
	});
}
