<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import { DotsHorizontal } from 'radix-icons-svelte';
	import { toast } from 'svelte-sonner';
	import { getMediaType } from '$lib/app/helpers';

	export let link: string;
	export let filename: string;

	let unrestrictLink = async function unrestrictLinkData(link: string) {
		const data = await fetch(`/api/app/unrestrict`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ link })
		});
		let resp = await data.json();
		if (resp.success === true) {
			toast.success(`Success!. Copied link to clipboard`);
		} else if (resp.success === false) {
			toast.error(`Error! ${resp.error}`);
		}
		return resp.data.download;
	};

	async function sendToDownloadStation() {
		const data = await fetch(`/api/app/unrestrict`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ link })
		});
		const resp = await data.json();
		if (!resp.success) {
			toast.error(`Error! ${resp.error}`);
			return;
		}

		const type = getMediaType(filename) === 'tv' ? 'series' : 'movie';
		const taskRes = await fetch(`/api/app/synology/addTask`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ url: resp.data.download, type, title: filename })
		});
		const taskResp = await taskRes.json();
		if (taskResp.success) {
			toast.success('Sent to Download Station');
		} else {
			toast.error(`Error! ${taskResp.error}`);
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger asChild let:builder>
		<Button variant="ghost" builders={[builder]} class="w-8 h-8 p- relative">
			<span class="sr-only">Open menu</span>
			<DotsHorizontal class="w-4 h-4" />
		</Button>
	</DropdownMenu.Trigger>
	<DropdownMenu.Content>
		<DropdownMenu.Group>
			<DropdownMenu.Label>Actions</DropdownMenu.Label>
			<DropdownMenu.Item
				on:click={() => {
					navigator.clipboard.writeText(link);
					toast.success('Copied link to clipboard');
				}}>Copy Restricted Link</DropdownMenu.Item
			>
		</DropdownMenu.Group>
		<DropdownMenu.Separator />
		<DropdownMenu.Item
			on:click={async () => {
				navigator.clipboard.writeText(await unrestrictLink(link));
			}}>Unrestrict & Copy Link</DropdownMenu.Item
		>
		<DropdownMenu.Item on:click={sendToDownloadStation}>Send to Download Station</DropdownMenu.Item
		>
	</DropdownMenu.Content>
</DropdownMenu.Root>
