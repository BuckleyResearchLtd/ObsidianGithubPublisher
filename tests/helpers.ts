import { App, TFile } from "obsidian";
import { GitHubPublisherSettings } from "../src/settings";

export type VaultEntry = {
	path: string;
	frontmatter?: Record<string, unknown>;
	embeds?: string[];
	binary?: Uint8Array;
};

export const baseSettings: GitHubPublisherSettings = {
	repo: "my-repo",
	owner: "my-owner",
	gitPAT: "token",
	contentDir: "src/content/",
	assetsDir: "src/assets/",
	assetsRelativePath: "../../assets/",
	branch: "main",
	usePostTypeSubdirectories: true,
	autoPublish: false,
};

export function settingsWith(
	overrides: Partial<GitHubPublisherSettings>,
): GitHubPublisherSettings {
	return { ...baseSettings, ...overrides };
}

function basename(path: string): string {
	const parts = path.split("/");
	return parts[parts.length - 1] ?? path;
}

export function createVault(entries: VaultEntry[]) {
	const files = entries.map((entry) => {
		const file = new TFile();
		file.path = entry.path;
		file.name = basename(entry.path);
		return { file, entry };
	});

	const find = (link: string) => {
		const target = link.trim();
		const match =
			files.find((f) => f.file.path === target) ??
			files.find((f) => f.file.name === target) ??
			files.find(
				(f) => f.file.name.replace(/\.md$/i, "") === target,
			);
		return match ?? null;
	};

	const app = {
		metadataCache: {
			getFirstLinkpathDest: (link: string) => find(link)?.file ?? null,
			getFileCache: (file: TFile) => {
				const match = files.find((f) => f.file.path === file.path);
				if (!match) {
					return null;
				}
				return {
					frontmatter: match.entry.frontmatter,
					embeds: (match.entry.embeds ?? []).map((link) => ({
						link,
					})),
				};
			},
		},
		vault: {
			getMarkdownFiles: () =>
				files
					.filter((f) => f.file.path.endsWith(".md"))
					.map((f) => f.file),
			readBinary: (file: TFile) => {
				const match = files.find((f) => f.file.path === file.path);
				const bytes = match?.entry.binary ?? new Uint8Array();
				return Promise.resolve(
					bytes.buffer.slice(
						bytes.byteOffset,
						bytes.byteOffset + bytes.byteLength,
					),
				);
			},
		},
	};

	const fileFor = (path: string) => {
		const match = files.find((f) => f.file.path === path);
		if (!match) {
			throw new Error(`test vault has no file at ${path}`);
		}
		return match.file;
	};

	return { app: app as unknown as App, fileFor };
}
