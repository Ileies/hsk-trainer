import { defineEnvVars } from '@sveltejs/kit/env';

// These variables are optional at startup and are read at runtime, matching the app's existing behavior.
export const variables = defineEnvVars({
	OPENAI_KEY: { schema: (input) => input ?? '' },
	ADMIN_MAIL: { schema: (input) => input ?? '' },
	SMTP_HOST: { schema: (input) => input ?? '' },
	SMTP_PORT: { schema: (input) => input ?? '' },
	SMTP_SECURE: { schema: (input) => input ?? '' },
	SMTP_USER: { schema: (input) => input ?? '' },
	SMTP_PASS: { schema: (input) => input ?? '' },
	SMTP_FROM: { schema: (input) => input ?? '' },
	DATA_DIR: { schema: (input) => input ?? '' }
});
