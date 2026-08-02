<script lang="ts">
	import { Copy, PlusSquare, FolderDown } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { toast } from 'svelte-sonner';

	export let url: string;
	export let addToRD: (url: string) => void;
	export let title: string;
	export let type: 'movie' | 'series';
	export let season: number | undefined = undefined;

	async function sendToDownloadStation() {
		const taskRes = await fetch(`/api/app/synology/addTask`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ url, type, title, season })
		});
		const taskResp = await taskRes.json();
		if (taskResp.success) {
			toast.success('Sent to Download Station');
		} else {
			toast.error(`Error! ${taskResp.error}`);
		}
	}
</script>

<div class="flex items-center gap-2">
	<Tooltip.Root>
		<Tooltip.Trigger asChild let:builder>
			<Button
				variant="outline"
				builders={[builder]}
				on:click={() => {
					navigator.clipboard.writeText(url);
					toast.success('Copied to clipboard');
				}}
			>
				<Copy class="w-4 h-4" />
			</Button>
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>Copy download link</p>
		</Tooltip.Content>
	</Tooltip.Root>
	<Tooltip.Root>
		<Tooltip.Trigger asChild let:builder>
			<Button
				variant="outline"
				builders={[builder]}
				on:click={() => {
					addToRD(url);
					toast.success('Added to RD');
				}}
			>
				<PlusSquare class="w-4 h-4" />
			</Button>
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>Add torrent and this single download</p>
		</Tooltip.Content>
	</Tooltip.Root>
	<Tooltip.Root>
		<Tooltip.Trigger asChild let:builder>
			<Button variant="outline" builders={[builder]} on:click={sendToDownloadStation}>
				<FolderDown class="w-4 h-4" />
			</Button>
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>Send to Download Station</p>
		</Tooltip.Content>
	</Tooltip.Root>
</div>
