import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

export async function sendMagicLink(toEmail: string, token: string, origin: string) {
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
		text: `Click this link to sign in:\n\n${url}\n\nThis link expires in 15 minutes.`,
		html: `<p>Click <a href="${url}">here to sign in</a> to HSK Trainer.</p>
<p style="color:#888;font-size:0.9em">Or copy this link: ${url}</p>
<p style="color:#888;font-size:0.9em">This link expires in 15 minutes.</p>`
	});
}
