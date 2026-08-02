import { env } from '$env/dynamic/private';
import type { APIResponse } from '$lib/app/types';

interface RequestBody {
	url: string;
	type: 'movie' | 'series';
	title: string;
	season?: number;
}

export const POST = async ({ request, fetch }) => {
	const body: RequestBody = await request.json();
	const url = body?.url;
	const type = body?.type;
	const title = body?.title;
	const season = body?.season;

	try {
		if (!url || !type || !title || (type === 'series' && !season)) {
			return new Response(
				JSON.stringify({
					status: 400,
					success: false,
					error: 'Bad Request. url, type and title are required (season is required for series)'
				} as APIResponse),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		let resolvedUrl = url;
		try {
			const resolveRes = await fetch(url, { method: 'HEAD', redirect: 'follow' });
			resolvedUrl = resolveRes.url || url;
			console.log('Resolved download URL:', resolvedUrl);
		} catch (error) {
			console.error('Failed to resolve download URL, falling back to original:', error);
		}

		const synologyBaseUrl = `http://${env.SYNOLOGY_HOST}:${env.SYNOLOGY_PORT}/webapi`;

		const loginRes = await fetch(
			`${synologyBaseUrl}/auth.cgi?api=SYNO.API.Auth&version=6&method=login&account=${encodeURIComponent(
				env.SYNOLOGY_USERNAME ?? ''
			)}&passwd=${encodeURIComponent(
				env.SYNOLOGY_PASSWORD ?? ''
			)}&session=DownloadStation&format=sid`
		);
		const loginData = await loginRes.json();

		if (!loginData.success) {
			console.error('Synology DSM auth failed:', loginData);
			return new Response(
				JSON.stringify({
					status: 401,
					success: false,
					error: 'Could not authenticate with Synology DSM'
				} as APIResponse),
				{
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		const sid = loginData.data.sid;
		const basePath =
			type === 'movie'
				? env.SYNOLOGY_MOVIES_PATH ?? 'video/movies'
				: env.SYNOLOGY_TV_PATH ?? 'video/tv';

		let destination: string;
		let createFolderParentPath: string;
		let createFolderName: string;

		if (type === 'movie') {
			destination = `${basePath}/${title}`;
			createFolderParentPath = `/${basePath}`;
			createFolderName = title;
		} else {
			const seasonFolder = `Season ${String(season).padStart(2, '0')}`;
			destination = `${basePath}/${title}/${seasonFolder}`;
			createFolderParentPath = `/${basePath}/${title}`;
			createFolderName = seasonFolder;
		}

		const createFolderUrl = `${synologyBaseUrl}/entry.cgi?api=SYNO.FileStation.CreateFolder&version=2&method=create&folder_path=${encodeURIComponent(
			JSON.stringify([createFolderParentPath])
		)}&name=${encodeURIComponent(JSON.stringify([createFolderName]))}&force_parent=true&_sid=${sid}`;
		const createFolderRes = await fetch(createFolderUrl);
		const createFolderData = await createFolderRes.json();

		if (!createFolderData.success) {
			console.error('Synology CreateFolder failed:', createFolderData);
			return new Response(
				JSON.stringify({
					status: 500,
					success: false,
					error: 'Could not create destination folder on Synology'
				} as APIResponse),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		// resolvedUrl comes from Response.url, which is already percent-encoded (WHATWG URL
		// normalization) - decode it first so it isn't encoded twice (e.g. %20 -> %2520) below.
		let decodedResolvedUrl = resolvedUrl;
		try {
			decodedResolvedUrl = decodeURIComponent(resolvedUrl);
		} catch {
			// malformed sequence - fall back to the raw resolved URL
		}

		// DSM's DownloadStation.Task.cgi does not decode "+" back to a space (unlike
		// FileStation.CreateFolder), so URLSearchParams' form-urlencoded "+" for spaces breaks
		// destination matching here - encode manually with %20-style escaping instead.
		const taskCreateUrl = `${synologyBaseUrl}/DownloadStation/task.cgi?api=SYNO.DownloadStation.Task&version=3&method=create&uri=${encodeURIComponent(
			decodedResolvedUrl
		)}&destination=${encodeURIComponent(destination)}&_sid=${sid}`;
		console.log('Synology addTask request:', {
			destination,
			url: taskCreateUrl.replace(/_sid=[^&]+/, '_sid=REDACTED')
		});

		const taskRes = await fetch(taskCreateUrl);
		const taskData = await taskRes.json();

		if (!taskData.success) {
			console.error('Synology DownloadStation task create failed:', taskData);
			return new Response(
				JSON.stringify({
					status: 500,
					success: false,
					error: 'Could not create Download Station task'
				} as APIResponse),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		return new Response(
			JSON.stringify({
				status: 200,
				success: true,
				message: 'Task added to Download Station'
			} as APIResponse),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		console.error('Synology addTask failed:', error);
		return new Response(
			JSON.stringify({
				status: 500,
				success: false,
				error: error instanceof Error ? error.message : String(error)
			} as APIResponse),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
