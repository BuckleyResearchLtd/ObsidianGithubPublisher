import { App, Notice, TFile } from 'obsidian';
import { MyPluginSettings } from 'settings';
import { Octokit } from "octokit";
import { CreateOrUpdateFiles } from "octokit-commit-multiple-files";

const MyOctokit = Octokit.plugin(CreateOrUpdateFiles);
// https://github.com/octokit/plugin-create-or-update-text-file.js/

function splitFrontmatter(text: string): { frontmatter: string; content: string; hasFrontmatter: boolean } {
	const fmRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
	const match = text.match(fmRegex);
	if (match && match[1] !== undefined && match[2] !== undefined) {
		return { frontmatter: match[1], content: match[2], hasFrontmatter: true };
	}
	return { frontmatter: '', content: text, hasFrontmatter: false };
}

function getImagesFromFrontmatter(frontmatter: string): string[] {
	const wikilinkRegex = /!?\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;
	const images: string[] = [];
	let match;
	while ((match = wikilinkRegex.exec(frontmatter)) !== null) {
		if (match[1]) {
			const linkPath = match[1].trim();
			if (/\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(linkPath)) {
				images.push(linkPath);
			}
		}
	}
	return images;
}

function transformFrontmatterImageLinks(app: App, frontmatter: string, sourcePath: string): string {
	const wikilinkRegex = /!?\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;

	return frontmatter.replace(wikilinkRegex, (match, linkPath, _, displayText) => {
		try {
			const imageFile = app.metadataCache.getFirstLinkpathDest(linkPath.trim(), sourcePath);

			if (!imageFile) {
				return match;
			}

			if (!/\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(imageFile.name)) {
				return match;
			}

			const sanitizedFilename = imageFile.name.replace(/\s+/g, '-');
			const githubImagePath = `../../assets/${sanitizedFilename}`;

			return githubImagePath;

		} catch (error) {
			console.warn(`Failed to transform frontmatter image link: ${linkPath}`, error);
			return match;
		}
	});
}

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
	new Notice(`Publishing ${file.name}...`);

	try {
		const path = `src/content/${postType}/${file.name}`;
		const commitMsg = `obsidian: create or update ${path} at ${new Date().toISOString()}`;

		const { frontmatter, content, hasFrontmatter } = splitFrontmatter(text);

		const transformedFrontmatter = hasFrontmatter
			? transformFrontmatterImageLinks(app, frontmatter, file.path)
			: '';

		const transformedContent = transformImageLinks(app, content, file.path);

		const transformedText = hasFrontmatter
			? `---\n${transformedFrontmatter}\n---\n${transformedContent}`
			: transformedContent;

		const imageLinksFromContent = getImagesFromFile(app, file);

		const imageLinksFromFrontmatter = hasFrontmatter
			? getImagesFromFrontmatter(frontmatter)
			: [];

		const allImageLinks = [...new Set([...imageLinksFromContent, ...imageLinksFromFrontmatter])];

		const images = await Promise.all(allImageLinks.map(link => resolveImage(app, link, file.path)));

		await githubPostFile(transformedText, path, settings, PAT, commitMsg, images);

		const imageCount = images.length;
		const msg = imageCount > 0
			? `Published ${file.name} with ${imageCount} image${imageCount === 1 ? '' : 's'}`
			: `Published ${file.name}`;
		new Notice(msg);
	} catch (error: any) {
		const errorMsg = error?.message || String(error) || 'Unknown error';
		new Notice(`Failed to publish ${file.name}: ${errorMsg}`);
		throw error;
	}
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

async function githubPostFile(text: string, path: string, settings: MyPluginSettings, PAT: string, commitMsg: string, images: { path: string; base64: string }[]) {
	const octokit = new MyOctokit({ auth: PAT });
	const files: Record<string, string> = { [path]: text };
	for (const image of images) {
		files[image.path] = image.base64;
	}

	await octokit.createOrUpdateFiles({
		owner: settings.owner,
		repo: settings.repo,
		branch: "main",
		createBranch: false,
		changes: [{
			message: commitMsg,
			files: files,
		}]
	});
}

async function githubDeleteFiles(paths: string[], settings: MyPluginSettings, PAT: string, commitMsg: string) {
	const octokit = new MyOctokit({ auth: PAT });

	// Delete all files in a single atomic commit
	await octokit.createOrUpdateFiles({
		owner: settings.owner,
		repo: settings.repo,
		branch: "main",
		createBranch: false,
		changes: [{
			message: commitMsg,
			filesToDelete: paths,
			ignoreDeletionFailures: false,
		}]
	});
}


async function getUnusedImages(app: App, imagePaths: string[], excludeFile: TFile): Promise<string[]> {
	// Get all published files except the one being unpublished
	const allFiles = app.vault.getMarkdownFiles();
	const publishedFiles = allFiles.filter(f => {
		if (f.path === excludeFile.path) return false;
		const cache = app.metadataCache.getFileCache(f);
		const fm = cache?.frontmatter;
		return fm && fm["pb-publish"] === true;
	});

	// Get all image links from all published files
	const allImagePaths = new Set<string>();
	for (const file of publishedFiles) {
		const links = getImagesFromFile(app, file);
		for (const link of links) {
			const imageFile = app.metadataCache.getFirstLinkpathDest(link, file.path);
			if (imageFile) {
				// Sanitize the filename to match what's in GitHub
				const sanitizedFilename = imageFile.name.replace(/\s+/g, '-');
				allImagePaths.add(`src/assets/${sanitizedFilename}`);
			}
		}
	}

	// Filter images to only those not used elsewhere
	return imagePaths.filter(imgPath => !allImagePaths.has(imgPath));
}

export async function unpublishSingleFile(app: App, file: TFile, settings: MyPluginSettings, PAT: string, postType: string) {
	new Notice(`Unpublishing ${file.name}...`);

	try {
		const path = `src/content/${postType}/${file.name}`;

		const imageLinks = getImagesFromFile(app, file);
		const imagePaths = await Promise.all(
			imageLinks.map(async link => {
				const imageFile = app.metadataCache.getFirstLinkpathDest(link, file.path);
				if (!imageFile) return null;
				const sanitizedFilename = imageFile.name.replace(/\s+/g, '-');
				return `src/assets/${sanitizedFilename}`;
			})
		);
		const validImagePaths = imagePaths.filter((p): p is string => p !== null);

		const imagesToDelete = await getUnusedImages(app, validImagePaths, file);

		const allPathsToDelete = [path, ...imagesToDelete];

		const commitMsg = `obsidian: deleted ${path}${imagesToDelete.length > 0 ? ` and ${imagesToDelete.length} unused image(s)` : ''} at ${new Date().toISOString()}`;
		await githubDeleteFiles(allPathsToDelete, settings, PAT, commitMsg);

		const msg = imagesToDelete.length > 0
			? `Unpublished ${file.name} and deleted ${imagesToDelete.length} unused image${imagesToDelete.length === 1 ? '' : 's'}`
			: `Unpublished ${file.name}`;
		new Notice(msg);
	} catch (error: any) {
		const errorMsg = error?.message || String(error) || 'Unknown error';
		new Notice(`Failed to unpublish ${file.name}: ${errorMsg}`);
		throw error;
	}
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
