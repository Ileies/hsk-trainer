import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPracticeData, parseNullableInt, parsePositiveIds } from '$lib/server/practice';

export const GET: RequestHandler = async ({ url }) => {
	const hsk = parseNullableInt(url.searchParams.get('hsk'));
	const excludeIds = parsePositiveIds(url.searchParams.get('exclude'));
	const lastId = parseNullableInt(url.searchParams.get('last'));

	return json(await getPracticeData(hsk, excludeIds, lastId));
};
