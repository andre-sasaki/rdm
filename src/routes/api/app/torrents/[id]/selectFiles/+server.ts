import { PUBLIC_BASE_URI } from '$env/static/public';
import type { APIResponse } from '$lib/app/types';

interface RequestBody {
	fileIds: number[];
}

export const POST = async ({ fetch, cookies, request, params }) => {
	const id: string = params.id;
	let accessToken: string | undefined = cookies.get('accessToken');
	const refreshToken: string | undefined = cookies.get('refreshToken');
	const body: RequestBody = await request.json();
	const fileIds = body?.fileIds;

	try {
		if (!refreshToken) {
			return new Response(
				JSON.stringify({
					status: 401,
					success: false,
					error: 'Unauthorized. No access token or refresh token.'
				} as APIResponse),
				{
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		if (!fileIds || fileIds.length === 0) {
			return new Response(
				JSON.stringify({
					status: 400,
					success: false,
					error: 'Bad Request. No fileIds provided'
				} as APIResponse),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		if (!accessToken) {
			const res = await fetch('/api/refresh', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			const data: APIResponse = await res.json();
			if (!data.success) {
				return new Response(
					JSON.stringify({
						success: false,
						status: 401,
						error: 'No access token or refresh token'
					} as APIResponse),
					{
						status: 401,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}

			accessToken = cookies.get('accessToken');
		}

		const selectRes = await fetch(`${PUBLIC_BASE_URI}/torrents/selectFiles/${id}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`
			},
			body: `files=${fileIds.join(',')}`
		});

		switch (selectRes.status) {
			case 204:
				return new Response(
					JSON.stringify({
						status: 204,
						success: true,
						message: 'Files selected'
					} as APIResponse),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				);

			case 202:
				return new Response(
					JSON.stringify({
						status: 202,
						success: true,
						message: 'Torrent already selected'
					} as APIResponse),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				);

			default:
				return new Response(
					JSON.stringify({
						status: selectRes.status,
						success: false,
						error: 'Bad request. Could not select files'
					} as APIResponse),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					}
				);
		}
	} catch (error) {
		return new Response(
			JSON.stringify({ status: 500, success: false, error: error } as APIResponse),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
