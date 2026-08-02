import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';

vi.mock('$env/dynamic/private', () => ({
	env: {
		SYNOLOGY_HOST: 'nas.local',
		SYNOLOGY_PORT: '5000',
		SYNOLOGY_USERNAME: 'test',
		SYNOLOGY_PASSWORD: 'test'
	}
}));

function makeEvent(body: unknown) {
	return {
		request: new Request('http://localhost/api/app/synology/addTask', {
			method: 'POST',
			body: JSON.stringify(body)
		}),
		fetch
	} as any;
}

const resolvedDownloadUrl = 'https://sea4-4.download.real-debrid.com/d/abc123/file.mkv';

function mockResolve() {
	(fetch as any).mockResolvedValueOnce({ url: resolvedDownloadUrl });
}

describe('POST /api/app/synology/addTask', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	it('returns 400 when required fields are missing', async () => {
		const res = await POST(makeEvent({ url: 'https://example.com/file.mkv' }));
		const data = await res.json();

		expect(res.status).toBe(400);
		expect(data.success).toBe(false);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('returns 401 when DSM auth fails', async () => {
		mockResolve();
		(fetch as any).mockResolvedValueOnce({
			json: async () => ({ success: false })
		});

		const res = await POST(
			makeEvent({ url: 'https://example.com/file.mkv', type: 'movie', title: 'Some Movie' })
		);
		const data = await res.json();

		expect(res.status).toBe(401);
		expect(data.success).toBe(false);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('returns 500 when create folder fails after successful auth', async () => {
		mockResolve();
		(fetch as any)
			.mockResolvedValueOnce({ json: async () => ({ success: true, data: { sid: 'abc123' } }) })
			.mockResolvedValueOnce({ json: async () => ({ success: false }) });

		const res = await POST(
			makeEvent({ url: 'https://example.com/file.mkv', type: 'movie', title: 'Some Movie' })
		);
		const data = await res.json();

		expect(res.status).toBe(500);
		expect(data.success).toBe(false);
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('returns 500 when task creation fails after successful auth and folder creation', async () => {
		mockResolve();
		(fetch as any)
			.mockResolvedValueOnce({ json: async () => ({ success: true, data: { sid: 'abc123' } }) })
			.mockResolvedValueOnce({ json: async () => ({ success: true }) })
			.mockResolvedValueOnce({ json: async () => ({ success: false }) });

		const res = await POST(
			makeEvent({ url: 'https://example.com/file.mkv', type: 'movie', title: 'Some Movie' })
		);
		const data = await res.json();

		expect(res.status).toBe(500);
		expect(data.success).toBe(false);
		expect(fetch).toHaveBeenCalledTimes(4);
	});

	it('sends destination under video/movies for movies and resolves the download URL', async () => {
		mockResolve();
		(fetch as any)
			.mockResolvedValueOnce({ json: async () => ({ success: true, data: { sid: 'abc123' } }) })
			.mockResolvedValueOnce({ json: async () => ({ success: true }) })
			.mockResolvedValueOnce({ json: async () => ({ success: true }) });

		const res = await POST(
			makeEvent({ url: 'https://example.com/file.mkv', type: 'movie', title: 'Some Movie' })
		);
		const data = await res.json();

		const createFolderCallUrl = (fetch as any).mock.calls[2][0] as string;
		expect(createFolderCallUrl).toContain(encodeURIComponent(JSON.stringify(['/video/movies'])));
		expect(createFolderCallUrl).toContain(encodeURIComponent(JSON.stringify(['Some Movie'])));

		const taskCallUrl = (fetch as any).mock.calls[3][0] as string;
		const taskCallParams = new URL(taskCallUrl).searchParams;
		expect(taskCallParams.get('destination')).toBe('video/movies/Some Movie');
		expect(taskCallParams.get('uri')).toBe(resolvedDownloadUrl);
		// DSM's DownloadStation.Task.cgi doesn't decode "+" back to a space, so spaces must be
		// sent as %20, not form-urlencoded "+" (which URLSearchParams.toString() would produce).
		expect(taskCallUrl).toContain('Some%20Movie');
		expect(taskCallUrl).not.toContain('Some+Movie');
		expect(res.status).toBe(200);
		expect(data.success).toBe(true);
	});

	it('does not double-encode a resolved URL containing spaces', async () => {
		const spacedUrl = 'https://sea1-4.download.real-debrid.com/d/abc/Rick and Morty - S09E02.mkv';
		(fetch as any)
			.mockResolvedValueOnce({ url: spacedUrl })
			.mockResolvedValueOnce({ json: async () => ({ success: true, data: { sid: 'abc123' } }) })
			.mockResolvedValueOnce({ json: async () => ({ success: true }) })
			.mockResolvedValueOnce({ json: async () => ({ success: true }) });

		await POST(
			makeEvent({ url: 'https://example.com/file.mkv', type: 'movie', title: 'Some Movie' })
		);

		const taskCallUrl = (fetch as any).mock.calls[3][0] as string;
		const taskCallParams = new URL(taskCallUrl).searchParams;
		expect(taskCallParams.get('uri')).toBe(spacedUrl);
		expect(taskCallUrl).not.toContain('%2520');
	});

	it('returns 400 when series request is missing season', async () => {
		const res = await POST(
			makeEvent({ url: 'https://example.com/file.mkv', type: 'series', title: 'Some Show' })
		);
		const data = await res.json();

		expect(res.status).toBe(400);
		expect(data.success).toBe(false);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('sends destination under show/Season NN for series', async () => {
		mockResolve();
		(fetch as any)
			.mockResolvedValueOnce({ json: async () => ({ success: true, data: { sid: 'abc123' } }) })
			.mockResolvedValueOnce({ json: async () => ({ success: true }) })
			.mockResolvedValueOnce({ json: async () => ({ success: true }) });

		await POST(
			makeEvent({
				url: 'https://example.com/file.mkv',
				type: 'series',
				title: 'Some Show (2021)',
				season: 1
			})
		);

		const createFolderCallUrl = (fetch as any).mock.calls[2][0] as string;
		expect(createFolderCallUrl).toContain(
			encodeURIComponent(JSON.stringify(['/video/tv/Some Show (2021)']))
		);
		expect(createFolderCallUrl).toContain(encodeURIComponent(JSON.stringify(['Season 01'])));

		const taskCallUrl = (fetch as any).mock.calls[3][0] as string;
		const taskCallParams = new URL(taskCallUrl).searchParams;
		expect(taskCallParams.get('destination')).toBe('video/tv/Some Show (2021)/Season 01');
	});

	it('falls back to the original URL if resolution fails', async () => {
		(fetch as any)
			.mockRejectedValueOnce(new Error('network error'))
			.mockResolvedValueOnce({ json: async () => ({ success: true, data: { sid: 'abc123' } }) })
			.mockResolvedValueOnce({ json: async () => ({ success: true }) })
			.mockResolvedValueOnce({ json: async () => ({ success: true }) });

		await POST(
			makeEvent({ url: 'https://example.com/file.mkv', type: 'movie', title: 'Some Movie' })
		);

		const taskCallUrl = (fetch as any).mock.calls[3][0] as string;
		const taskCallParams = new URL(taskCallUrl).searchParams;
		expect(taskCallParams.get('uri')).toBe('https://example.com/file.mkv');
	});
});
