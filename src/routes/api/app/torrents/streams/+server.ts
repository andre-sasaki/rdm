import { PUBLIC_TORRENTIO_BASE_URI } from '$env/static/public';
import type { APIResponse } from '$lib/app/types';

export const GET = async ({ url, fetch, cookies }) => {
	const id = url.searchParams.get('id');
	const type = url.searchParams.get('type');
	const filters = url.searchParams.get('filters') ?? '';
	const debridOptions = url.searchParams.get('debridOptions') ?? 'debridoptions=nodownloadlinks';
	const limitPerQuality = url.searchParams.get('limitPerQuality');

	if (!id || !type) {
		return new Response(
			JSON.stringify({ status: 400, success: false, error: 'Missing id or type' } as APIResponse),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	const accessToken = cookies.get('accessToken');
	if (!accessToken) {
		return new Response(
			JSON.stringify({ status: 401, success: false, error: 'Unauthorized' } as APIResponse),
			{ status: 401, headers: { 'Content-Type': 'application/json' } }
		);
	}

	let otherFilters = `|${debridOptions}|realdebrid=${accessToken}`;
	if (limitPerQuality) {
		otherFilters += `|limit=${limitPerQuality}`;
	}

	try {
		const res = await fetch(
			`${PUBLIC_TORRENTIO_BASE_URI}/qualityfilter=${filters}${otherFilters}/stream/${type}/${id}.json`
		);
		const data = await res.json();

		return new Response(JSON.stringify({ status: 200, success: true, data } as APIResponse), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(
			JSON.stringify({ status: 500, success: false, error } as APIResponse),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
