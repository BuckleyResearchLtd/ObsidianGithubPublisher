import { App, TFile } from 'obsidian';
import { MyPluginSettings } from 'settings';
import { Octokit } from "octokit";
import { CreateOrUpdateFiles } from "octokit-commit-multiple-files";

const MyOctokit = Octokit.plugin(CreateOrUpdateFiles);
// https://github.com/octokit/plugin-create-or-update-text-file.js/

function transformImageLinks(app: App, content: string, sourcePath: string): string {
	// Regex to match image wikilinks: ![[path/to/image.png]] or ![[image.png|caption]]
	// Captures: full match, link path, optional display text
	const wikilinkRegex = /!\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;

	return content.replace(wikilinkRegex, (match, linkPath, _, displayText) => {
		try {
			// Resolve the wikilink to actual file using Obsidian's API
			const imageFile = app.metadataCache.getFirstLinkpathDest(linkPath.trim(), sourcePath);

			if (!imageFile) {
				// If image can't be resolved, leave original wikilink (or optionally log warning)
				return match;
			}

			// Check if it's actually an image file
			if (!/\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(imageFile.name)) {
				return match; // Not an image, leave as-is
			}

			// Build GitHub path where image will be stored
			// Replace spaces with hyphens in filename for URL compatibility
		const sanitizedFilename = imageFile.name.replace(/\s+/g, '-');
		const githubImagePath = `../../assets/${sanitizedFilename}`;

			// Use display text if provided, otherwise use empty alt text
			const altText = displayText?.trim() || '';

			// Return standard markdown image syntax
			return `![${altText}](${githubImagePath})`;

		} catch (error) {
			// On any error, preserve original wikilink
			console.warn(`Failed to transform image link: ${linkPath}`, error);
			return match;
		}
	});
}

export async function publishSingleFile(app: App, file: TFile, text: string, settings: MyPluginSettings, PAT: string, postType: string) {
	const path = `src/content/${postType}/${file.name}`;
	const commitMsg = `obsidian: create or update ${path} at ${new Date()}`;

	// Transform image wikilinks to standard markdown
	const transformedText = transformImageLinks(app, text, file.path);

	const imageLinks = getImagesFromFile(app, file);
	const images = await Promise.all(imageLinks.map(link => resolveImage(app, link, file.path)));

	// Use transformed text instead of original
	await githubPostFile(transformedText, path, settings, PAT, commitMsg, images);
}

function getImagesFromFile(app: App, file: TFile): string[] {
	const cache = app.metadataCache.getFileCache(file);
	const images = cache?.embeds?.map(e => e.link).filter(link => /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(link));
	return images ?? [];
}

async function resolveImage(app: App, link: string, sourcePath: string): Promise<{ path: string; base64: string }> {
	const imageFile = app.metadataCache.getFirstLinkpathDest(link, sourcePath)!;
	const buf = await app.vault.readBinary(imageFile as TFile);
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]!);
	}
	// Replace spaces with hyphens in filename for URL compatibility
	const sanitizedFilename = imageFile.name.replace(/\s+/g, '-');
	return { path: `src/assets/${sanitizedFilename}`, base64: btoa(binary) };
}

async function githubPostFile(text: string | null, path: string, settings: MyPluginSettings, PAT: string, commitMsg: string, images: { path: string; base64: string }[]) {
	const octokit = new MyOctokit({ auth: PAT });
	const files: Record<string, string | null> = { [path]: text };
	for (const image of images) {
		files[image.path] = image.base64;
	}

	const res = await octokit.createOrUpdateFiles({
		owner: settings.owner,
		repo: settings.repo,
		branch: "main",
		createBranch: false,
		changes: [{
			message: commitMsg,
			files: files,
		}]});
	console.log("res", res)
	//todo give feedback
}

function getSHAOrNone(octokit: Octokit, path: string, owner: string, repo: string) {
	return octokit.rest.repos.getContent({ owner, repo, path })
		.then((res: any) => res?.data?.sha)
		.catch((err: any) => {
			console.log(err);
			return null;
		});
}


export async function unpublishSingleFile(file: TFile, text: string, settings: MyPluginSettings, PAT: string, postType: string) {
	const path = `src/content/${postType}/${file.name}`;
	const commitMsg = `obsidian: deleted ${path} at ${new Date()}`;
	await githubPostFile(null, path, settings, PAT, commitMsg, []);
}


function getFilesToPublish(app: App): [TFile[], TFile[]] {
  const files = app.vault.getMarkdownFiles(); // all .md files in vault[web:51]

  const toPublish = files.filter((file) => {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    return fm && fm["pb-publish"] === true;
  });

  const toUnpublish = files.filter((file) => {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    return fm && fm["pb-publish"] === true;
  });

  return [toPublish, toUnpublish];
}

export function publishMultiplFiles(app: App) {
	const [toPublish, toUnpublish] = getFilesToPublish(app);

}
