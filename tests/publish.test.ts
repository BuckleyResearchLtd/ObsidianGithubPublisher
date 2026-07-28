import { describe, expect, it, beforeEach, vi } from "vitest";
import { createVault, baseSettings, settingsWith } from "./helpers";
import { noticeMessages } from "./mocks/obsidian";

const { git, constructorOptions } = vi.hoisted(() => ({
	git: {
		getRef: vi.fn(),
		getCommit: vi.fn(),
		getTree: vi.fn(),
		createBlob: vi.fn(),
		createTree: vi.fn(),
		createCommit: vi.fn(),
		updateRef: vi.fn(),
	},
	constructorOptions: [] as unknown[],
}));

vi.mock("@octokit/rest", () => ({
	Octokit: class {
		rest = { git };
		constructor(options: unknown) {
			constructorOptions.push(options);
		}
	},
}));

import { publishSingleFile, unpublishSingleFile } from "../src/publish";

type BlobArgs = { path?: string; content: string; encoding: string };
type TreeEntry = {
	path: string;
	mode: string;
	type: string;
	sha: string | null;
};

function blobCalls(): BlobArgs[] {
	return git.createBlob.mock.calls.map((call) => call[0] as BlobArgs);
}

function treeEntries(): TreeEntry[] {
	const call = git.createTree.mock.calls[0]?.[0] as
		| { tree: TreeEntry[] }
		| undefined;
	return call?.tree ?? [];
}

function committedContent(path: string): string {
	const entry = treeEntries().find((item) => item.path === path);
	const blob = blobCalls().find(
		(_, index) => `blob-sha-${index}` === entry?.sha,
	);
	if (!blob) {
		throw new Error(`no blob committed at ${path}`);
	}
	return blob.content;
}

function setTreePaths(paths: string[], truncated = false) {
	git.getTree.mockResolvedValue({
		data: {
			truncated,
			tree: paths.map((path) => ({ path, type: "blob" })),
		},
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	constructorOptions.length = 0;
	noticeMessages.length = 0;

	git.getRef.mockResolvedValue({ data: { object: { sha: "head-sha" } } });
	git.getCommit.mockResolvedValue({ data: { tree: { sha: "base-tree" } } });
	git.createBlob.mockImplementation(() =>
		Promise.resolve({
			data: { sha: `blob-sha-${git.createBlob.mock.calls.length - 1}` },
		}),
	);
	git.createTree.mockResolvedValue({ data: { sha: "new-tree" } });
	git.createCommit.mockResolvedValue({ data: { sha: "new-commit" } });
	git.updateRef.mockResolvedValue({ data: {} });
	setTreePaths([]);
});

const NOTE = "notes/My Post.md";

function embedsIn(body: string): string[] {
	const regex = /!\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;
	const links: string[] = [];
	let match;
	while ((match = regex.exec(body)) !== null) {
		if (match[1]) {
			links.push(match[1].trim());
		}
	}
	return links;
}

function vaultWithNote(
	body: string,
	extra: Parameters<typeof createVault>[0] = [],
) {
	return createVault([
		{
			path: NOTE,
			frontmatter: { "pb-publish": true, "pb-type": "blog" },
			embeds: embedsIn(body),
		},
		...extra,
	]);
}

async function publish(
	body: string,
	extra: Parameters<typeof createVault>[0] = [],
	settings = baseSettings,
) {
	const { app, fileFor } = vaultWithNote(body, extra);
	await publishSingleFile(
		app,
		fileFor(NOTE),
		body,
		settings,
		"token",
		"blog",
	);
	return { app, fileFor };
}

describe("publish: git data api flow", () => {
	it("authenticates with the configured PAT", async () => {
		await publish("hello");
		expect(constructorOptions).toEqual([{ auth: "token" }]);
	});

	it("commits the note as utf-8 at the post-type path", async () => {
		await publish("hello world");

		const blobs = blobCalls();
		expect(blobs).toHaveLength(1);
		expect(blobs[0]).toMatchObject({
			content: "hello world",
			encoding: "utf-8",
		});
		expect(treeEntries()).toEqual([
			{
				path: "src/content/blog/my-post.md",
				mode: "100644",
				type: "blob",
				sha: "blob-sha-0",
			},
		]);
	});

	it("omits the post-type subdirectory when disabled", async () => {
		await publish(
			"hello",
			[],
			settingsWith({ usePostTypeSubdirectories: false }),
		);
		expect(treeEntries()[0]?.path).toBe("src/content/my-post.md");
	});

	it("builds the commit on the current head and updates the branch ref", async () => {
		await publish("hello");

		expect(git.getRef).toHaveBeenCalledWith(
			expect.objectContaining({
				owner: "my-owner",
				repo: "my-repo",
				ref: "heads/main",
			}),
		);
		expect(git.createTree).toHaveBeenCalledWith(
			expect.objectContaining({ base_tree: "base-tree" }),
		);
		expect(git.createCommit).toHaveBeenCalledWith(
			expect.objectContaining({
				tree: "new-tree",
				parents: ["head-sha"],
			}),
		);
		expect(git.updateRef).toHaveBeenCalledWith(
			expect.objectContaining({ ref: "heads/main", sha: "new-commit" }),
		);
	});

	it("reports a clear error when the branch is missing", async () => {
		git.getRef.mockRejectedValue(Object.assign(new Error("Not Found"), {
			status: 404,
		}));

		await expect(publish("hello")).rejects.toThrow(
			"Branch 'main' does not exist in my-owner/my-repo",
		);
		expect(git.updateRef).not.toHaveBeenCalled();
	});

	it("does not update the ref when a blob fails", async () => {
		git.createBlob.mockRejectedValue(new Error("boom"));

		await expect(publish("hello")).rejects.toThrow("boom");
		expect(git.createCommit).not.toHaveBeenCalled();
		expect(git.updateRef).not.toHaveBeenCalled();
	});
});

describe("publish: image handling", () => {
	const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

	it("sends images base64-encoded and the note as utf-8", async () => {
		await publish("text ![[Cover Image.png]] more", [
			{ path: "assets/Cover Image.png", binary: png },
		]);

		const blobs = blobCalls();
		expect(blobs).toHaveLength(2);

		const image = blobs.find((b) => b.encoding === "base64");
		const note = blobs.find((b) => b.encoding === "utf-8");
		expect(note).toBeDefined();
		expect(image?.content).toBe(
			Buffer.from(png).toString("base64"),
		);
	});

	it("commits the image at the sanitized assets path", async () => {
		await publish("![[Cover Image.png]]", [
			{ path: "assets/Cover Image.png", binary: png },
		]);

		expect(treeEntries().map((e) => e.path)).toEqual(
			expect.arrayContaining(["src/assets/cover-image.png"]),
		);
	});

	it("deduplicates an image embedded twice", async () => {
		await publish("![[a.png]] and again ![[a.png]]", [
			{ path: "assets/a.png", binary: png },
		]);

		expect(blobCalls().filter((b) => b.encoding === "base64")).toHaveLength(
			1,
		);
	});
});

describe("publish: link transforms", () => {
	const png = new Uint8Array([1, 2, 3]);
	const notePath = "src/content/blog/my-post.md";

	it("rewrites image embeds to the relative assets path", async () => {
		await publish("before ![[Cover Image.png]] after", [
			{ path: "assets/Cover Image.png", binary: png },
		]);

		expect(committedContent(notePath)).toBe(
			"before ![](../../assets/cover-image.png) after",
		);
	});

	it("uses the wikilink alias as alt text", async () => {
		await publish("![[a.png|A picture]]", [
			{ path: "assets/a.png", binary: png },
		]);

		expect(committedContent(notePath)).toBe(
			"![A picture](../../assets/a.png)",
		);
	});

	it("links to other published notes by post type", async () => {
		await publish("see [[Other Note]]", [
			{
				path: "notes/Other Note.md",
				frontmatter: { "pb-publish": true, "pb-type": "essays" },
			},
		]);

		expect(committedContent(notePath)).toBe(
			"see [Other Note](/essays/other-note)",
		);
	});

	it("strips links to unpublished notes but keeps the text", async () => {
		await publish("see [[Draft|the draft]]", [
			{
				path: "notes/Draft.md",
				frontmatter: { "pb-publish": false, "pb-type": "blog" },
			},
		]);

		expect(committedContent(notePath)).toBe("see the draft");
	});

	it("strips links to notes that do not exist", async () => {
		await publish("see [[Nowhere]]");
		expect(committedContent(notePath)).toBe("see Nowhere");
	});

	it("rewrites image links inside frontmatter to a bare path", async () => {
		const text = '---\ncover: "[[Cover.png]]"\n---\nbody\n';
		await publish(text, [{ path: "assets/Cover.png", binary: png }]);

		expect(committedContent(notePath)).toBe(
			'---\ncover: "../../assets/cover.png"\n---\nbody\n',
		);
	});

	it("publishes an image referenced only from frontmatter", async () => {
		const text = '---\ncover: "[[Cover.png]]"\n---\nbody\n';
		await publish(text, [{ path: "assets/Cover.png", binary: png }]);

		expect(treeEntries().map((e) => e.path)).toEqual(
			expect.arrayContaining(["src/assets/cover.png"]),
		);
	});

	it("leaves plain content untouched", async () => {
		await publish("just text, no links");
		expect(committedContent(notePath)).toBe("just text, no links");
	});
});

describe("unpublish", () => {
	const png = new Uint8Array([1, 2, 3]);

	async function unpublish(
		extra: Parameters<typeof createVault>[0] = [],
		embeds: string[] = [],
	) {
		const { app, fileFor } = createVault([
			{
				path: NOTE,
				frontmatter: { "pb-publish": true, "pb-type": "blog" },
				embeds,
			},
			...extra,
		]);
		await unpublishSingleFile(
			app,
			fileFor(NOTE),
			baseSettings,
			"token",
			"blog",
		);
	}

	it("deletes the note with a null sha tree entry", async () => {
		setTreePaths(["src/content/blog/my-post.md"]);
		await unpublish();

		expect(treeEntries()).toEqual([
			{
				path: "src/content/blog/my-post.md",
				mode: "100644",
				type: "blob",
				sha: null,
			},
		]);
		expect(git.createBlob).not.toHaveBeenCalled();
		expect(git.updateRef).toHaveBeenCalledWith(
			expect.objectContaining({ sha: "new-commit" }),
		);
	});

	it("deletes images no other published note uses", async () => {
		setTreePaths([
			"src/content/blog/my-post.md",
			"src/assets/orphan.png",
		]);
		await unpublish([{ path: "assets/orphan.png", binary: png }], [
			"orphan.png",
		]);

		expect(treeEntries().map((e) => e.path)).toEqual([
			"src/content/blog/my-post.md",
			"src/assets/orphan.png",
		]);
	});

	it("keeps images still referenced by another published note", async () => {
		setTreePaths([
			"src/content/blog/my-post.md",
			"src/assets/shared.png",
		]);
		await unpublish(
			[
				{ path: "assets/shared.png", binary: png },
				{
					path: "notes/Keeper.md",
					frontmatter: { "pb-publish": true, "pb-type": "blog" },
					embeds: ["shared.png"],
				},
			],
			["shared.png"],
		);

		expect(treeEntries().map((e) => e.path)).toEqual([
			"src/content/blog/my-post.md",
		]);
	});

	it("fails when the file is not in the repo", async () => {
		setTreePaths(["src/content/blog/something-else.md"]);

		await expect(unpublish()).rejects.toThrow(
			"The file src/content/blog/my-post.md could not be found in the repo",
		);
		expect(git.updateRef).not.toHaveBeenCalled();
	});

	it("skips the existence check when the repo tree is truncated", async () => {
		setTreePaths([], true);
		await unpublish();

		expect(git.updateRef).toHaveBeenCalled();
		expect(treeEntries()[0]?.sha).toBeNull();
	});
});

describe("user notices", () => {
	const png = new Uint8Array([1, 2, 3]);

	it("announces start and success", async () => {
		await publish("hello");
		expect(noticeMessages).toEqual([
			"Publishing My Post.md...",
			"Published My Post.md",
		]);
	});

	it("counts published images", async () => {
		await publish("![[a.png]] ![[b.png]]", [
			{ path: "assets/a.png", binary: png },
			{ path: "assets/b.png", binary: png },
		]);
		expect(noticeMessages[noticeMessages.length - 1]).toBe("Published My Post.md with 2 images");
	});

	it("uses the singular for one image", async () => {
		await publish("![[a.png]]", [{ path: "assets/a.png", binary: png }]);
		expect(noticeMessages[noticeMessages.length - 1]).toBe("Published My Post.md with 1 image");
	});

	it("surfaces the failure reason", async () => {
		git.createTree.mockRejectedValue(new Error("rate limited"));

		await expect(publish("hello")).rejects.toThrow("rate limited");
		expect(noticeMessages[noticeMessages.length - 1]).toBe(
			"Failed to publish My Post.md: rate limited",
		);
	});
});

describe("mobile safety", () => {
	it("publishes without touching the Buffer global", async () => {
		const original = globalThis.Buffer;
		const png = new Uint8Array([137, 80, 78, 71]);
		const expected = original.from(png).toString("base64");

		// @ts-expect-error simulating the Obsidian mobile runtime
		delete globalThis.Buffer;
		try {
			await publish("![[a.png]]", [
				{ path: "assets/a.png", binary: png },
			]);
		} finally {
			globalThis.Buffer = original;
		}

		const image = blobCalls().find((b) => b.encoding === "base64");
		expect(image?.content).toBe(expected);
	});
});
