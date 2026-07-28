import { App, Notice, TFile } from "obsidian";
import { GitHubPublisherSettings } from "settings";
import { Octokit } from "@octokit/rest";

type CommitFile = {
	path: string;
	content: string;
	encoding: "utf-8" | "base64";
};

type TreeItem = {
	path: string;
	mode: "100644";
	type: "blob";
	sha: string | null;
};

function splitFrontmatter(text: string): {
	frontmatter: string;
	content: string;
	hasFrontmatter: boolean;
} {
	const fmRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
	const match = text.match(fmRegex);
	if (match && match[1] !== undefined && match[2] !== undefined) {
		return {
			frontmatter: match[1],
			content: match[2],
			hasFrontmatter: true,
		};
	}
	return { frontmatter: "", content: text, hasFrontmatter: false };
}

function sanitizeFilename(filename: string): string {
	return filename
		.replace(/\s+/g, "-")
		.replace(/[^\w.-]/g, "")
		.toLowerCase();
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

function transformFrontmatterImageLinks(
	app: App,
	frontmatter: string,
	sourcePath: string,
	settings: GitHubPublisherSettings,
): string {
	const wikilinkRegex = /!?\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;

	return frontmatter.replace(
		wikilinkRegex,
		(match, linkPath: string, _, __) => {
			try {
				const imageFile = app.metadataCache.getFirstLinkpathDest(
					linkPath.trim(),
					sourcePath,
				);

				if (!imageFile) {
					return match;
				}

				if (!/\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(imageFile.name)) {
					return match;
				}

				const sanitizedFilename = sanitizeFilename(imageFile.name);
				const githubImagePath = `${settings.assetsRelativePath}${sanitizedFilename}`;

				return githubImagePath;
			} catch (error) {
				console.warn(
					`Failed to transform frontmatter image link: ${linkPath}`,
					error,
				);
				return match;
			}
		},
	);
}

function transformImageLinks(
	app: App,
	content: string,
	sourcePath: string,
	settings: GitHubPublisherSettings,
): string {
	const wikilinkRegex = /!\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;

	return content.replace(
		wikilinkRegex,
		(match, linkPath: string, _, displayText: string) => {
			try {
				const imageFile = app.metadataCache.getFirstLinkpathDest(
					linkPath.trim(),
					sourcePath,
				);

				if (!imageFile) {
					return match;
				}

				if (!/\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(imageFile.name)) {
					return match;
				}

				const sanitizedFilename = sanitizeFilename(imageFile.name);
				const githubImagePath = `${settings.assetsRelativePath}${sanitizedFilename}`;

				const altText = displayText?.trim() || "";

				return `![${altText}](${githubImagePath})`;
			} catch (error) {
				console.warn(
					`Failed to transform image link: ${linkPath}`,
					error,
				);
				return match;
			}
		},
	);
}

function transformWikiLinks(
	app: App,
	content: string,
	sourcePath: string,
	settings: GitHubPublisherSettings,
): string {
	const wikilinkRegex = /(?<!!)\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;

	return content.replace(
		wikilinkRegex,
		(match, linkPath: string, _, displayText: string) => {
			try {
				const linkedFile = app.metadataCache.getFirstLinkpathDest(
					linkPath.trim(),
					sourcePath,
				);

				if (!linkedFile) {
					return displayText?.trim() || linkPath.trim();
				}

				if (/\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(linkedFile.name)) {
					return match;
				}

				const cache = app.metadataCache.getFileCache(linkedFile);
				const frontmatter = cache?.frontmatter;

				if (!frontmatter || frontmatter["pb-publish"] !== true) {
					return displayText?.trim() || linkPath.trim();
				}

				const postType: unknown = frontmatter["pb-type"];
				if (typeof postType !== "string" || !postType) {
					return displayText?.trim() || linkPath.trim();
				}

				const sanitizedFilename = sanitizeFilename(linkedFile.name);
				const filenameWithoutExtension = sanitizedFilename.replace(
					/\.md$/i,
					"",
				);
				const targetPath = settings.usePostTypeSubdirectories
					? `${postType}/${filenameWithoutExtension}`
					: `${filenameWithoutExtension}`;

				const linkText = displayText?.trim() || linkPath.trim();

				return `[${linkText}](/${targetPath})`;
			} catch (error) {
				console.warn(
					`Failed to transform wiki link: ${linkPath}`,
					error,
				);
				return displayText?.trim() || linkPath.trim();
			}
		},
	);
}

export async function publishSingleFile(
	app: App,
	file: TFile,
	text: string,
	settings: GitHubPublisherSettings,
	PAT: string,
	postType: string,
) {
	new Notice(`Publishing ${file.name}...`);

	try {
		const sanitizedFilename = sanitizeFilename(file.name);
		const path = settings.usePostTypeSubdirectories
			? `${settings.contentDir}${postType}/${sanitizedFilename}`
			: `${settings.contentDir}${sanitizedFilename}`;
		const commitMsg = `obsidian: create or update ${path} at ${new Date().toISOString()}`;

		const { frontmatter, content, hasFrontmatter } = splitFrontmatter(text);

		const transformedFrontmatter = hasFrontmatter
			? transformFrontmatterImageLinks(
				app,
				frontmatter,
				file.path,
				settings,
			)
			: "";

		let transformedContent = transformImageLinks(
			app,
			content,
			file.path,
			settings,
		);

		transformedContent = transformWikiLinks(
			app,
			transformedContent,
			file.path,
			settings,
		);

		const transformedText = hasFrontmatter
			? `---\n${transformedFrontmatter}\n---\n${transformedContent}`
			: transformedContent;

		const imageLinksFromContent = getImagesFromFile(app, file);

		const imageLinksFromFrontmatter = hasFrontmatter
			? getImagesFromFrontmatter(frontmatter)
			: [];

		const allImageLinks = [
			...new Set([
				...imageLinksFromContent,
				...imageLinksFromFrontmatter,
			]),
		];

		const images = await Promise.all(
			allImageLinks.map((link) =>
				resolveImage(app, link, file.path, settings),
			),
		);

		await githubPostFile(
			transformedText,
			path,
			settings,
			PAT,
			commitMsg,
			images,
		);

		const imageCount = images.length;
		const msg =
			imageCount > 0
				? `Published ${file.name} with ${imageCount} image${imageCount === 1 ? "" : "s"}`
				: `Published ${file.name}`;
		new Notice(msg);
	} catch (error: unknown) {
		let errorMsg;
		if (error instanceof Error && error.message) {
			errorMsg = error.message;
		} else if (typeof error === "string") {
			errorMsg = error;
		}
		new Notice(`Failed to publish ${file.name}: ${errorMsg}`);
		throw error;
	}
}

function getImagesFromFile(app: App, file: TFile): string[] {
	const cache = app.metadataCache.getFileCache(file);
	const images = cache?.embeds
		?.map((e) => e.link)
		.filter((link) => /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(link));
	return images ?? [];
}

async function resolveImage(
	app: App,
	link: string,
	sourcePath: string,
	settings: GitHubPublisherSettings,
): Promise<{ path: string; base64: string }> {
	const imageFile = app.metadataCache.getFirstLinkpathDest(link, sourcePath)!;
	const buf = await app.vault.readBinary(imageFile);
	const bytes = new Uint8Array(buf);
	let binary = "";
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]!);
	}
	const sanitizedFilename = sanitizeFilename(imageFile.name);
	return {
		path: `${settings.assetsDir}${sanitizedFilename}`,
		base64: btoa(binary),
	};
}

function isNotFound(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		(error as { status: number }).status === 404
	);
}

async function getTreeBlobPaths(
	octokit: Octokit,
	settings: GitHubPublisherSettings,
	treeSha: string,
): Promise<Set<string> | null> {
	const tree = await octokit.rest.git.getTree({
		owner: settings.owner,
		repo: settings.repo,
		tree_sha: treeSha,
		recursive: "true",
	});

	if (tree.data.truncated) {
		return null;
	}

	const paths = tree.data.tree
		.filter((entry) => entry.type === "blob")
		.map((entry) => entry.path);

	return new Set(paths);
}

async function commitChanges(
	settings: GitHubPublisherSettings,
	PAT: string,
	commitMsg: string,
	files: CommitFile[],
	pathsToDelete: string[],
) {
	if (files.length === 0 && pathsToDelete.length === 0) {
		return;
	}

	const octokit = new Octokit({ auth: PAT });
	const owner = settings.owner;
	const repo = settings.repo;
	const ref = `heads/${settings.branch}`;

	let headSha: string;
	try {
		const head = await octokit.rest.git.getRef({ owner, repo, ref });
		headSha = head.data.object.sha;
	} catch (error: unknown) {
		if (isNotFound(error)) {
			throw new Error(
				`Branch '${settings.branch}' does not exist in ${owner}/${repo}`,
			);
		}
		throw error;
	}

	const baseCommit = await octokit.rest.git.getCommit({
		owner,
		repo,
		commit_sha: headSha,
	});
	const baseTreeSha = baseCommit.data.tree.sha;

	if (pathsToDelete.length > 0) {
		const existingPaths = await getTreeBlobPaths(
			octokit,
			settings,
			baseTreeSha,
		);
		if (existingPaths) {
			const missing = pathsToDelete.find(
				(path) => !existingPaths.has(path),
			);
			if (missing) {
				throw new Error(
					`The file ${missing} could not be found in the repo`,
				);
			}
		}
	}

	const blobs = await Promise.all(
		files.map(async (file) => {
			const blob = await octokit.rest.git.createBlob({
				owner,
				repo,
				content: file.content,
				encoding: file.encoding,
			});
			return { path: file.path, sha: blob.data.sha };
		}),
	);

	const tree: TreeItem[] = [
		...blobs.map((blob) => ({
			path: blob.path,
			mode: "100644" as const,
			type: "blob" as const,
			sha: blob.sha,
		})),
		...pathsToDelete.map((path) => ({
			path,
			mode: "100644" as const,
			type: "blob" as const,
			sha: null,
		})),
	];

	const newTree = await octokit.rest.git.createTree({
		owner,
		repo,
		base_tree: baseTreeSha,
		tree,
	});

	const commit = await octokit.rest.git.createCommit({
		owner,
		repo,
		message: commitMsg,
		tree: newTree.data.sha,
		parents: [headSha],
	});

	await octokit.rest.git.updateRef({
		owner,
		repo,
		ref,
		sha: commit.data.sha,
	});
}

async function githubPostFile(
	text: string,
	path: string,
	settings: GitHubPublisherSettings,
	PAT: string,
	commitMsg: string,
	images: { path: string; base64: string }[],
) {
	const files: CommitFile[] = [
		{ path, content: text, encoding: "utf-8" },
		...images.map((image) => ({
			path: image.path,
			content: image.base64,
			encoding: "base64" as const,
		})),
	];

	await commitChanges(settings, PAT, commitMsg, files, []);
}

async function githubDeleteFiles(
	paths: string[],
	settings: GitHubPublisherSettings,
	PAT: string,
	commitMsg: string,
) {
	await commitChanges(settings, PAT, commitMsg, [], paths);
}

function getUnusedImages(
	app: App,
	imagePaths: string[],
	excludeFile: TFile,
	settings: GitHubPublisherSettings,
): string[] {
	const allFiles = app.vault.getMarkdownFiles();
	const publishedFiles = allFiles.filter((f) => {
		if (f.path === excludeFile.path) return false;
		const cache = app.metadataCache.getFileCache(f);
		const fm = cache?.frontmatter;
		return fm && fm["pb-publish"] === true;
	});

	const allImagePaths = new Set<string>();
	for (const file of publishedFiles) {
		const links = getImagesFromFile(app, file);
		for (const link of links) {
			const imageFile = app.metadataCache.getFirstLinkpathDest(
				link,
				file.path,
			);
			if (imageFile) {
				const sanitizedFilename = sanitizeFilename(imageFile.name);
				allImagePaths.add(`${settings.assetsDir}${sanitizedFilename}`);
			}
		}
	}

	return imagePaths.filter((imgPath) => !allImagePaths.has(imgPath));
}

export async function unpublishSingleFile(
	app: App,
	file: TFile,
	settings: GitHubPublisherSettings,
	PAT: string,
	postType: string,
) {
	new Notice(`Unpublishing ${file.name}...`);

	try {
		const sanitizedFilename = sanitizeFilename(file.name);
		const path = settings.usePostTypeSubdirectories
			? `${settings.contentDir}${postType}/${sanitizedFilename}`
			: `${settings.contentDir}${sanitizedFilename}`;

		const imageLinks = getImagesFromFile(app, file);
		const imagePaths = imageLinks.map((link) => {
			const imageFile = app.metadataCache.getFirstLinkpathDest(
				link,
				file.path,
			);
			if (!imageFile) return null;
			const sanitizedFilename = sanitizeFilename(imageFile.name);
			return `${settings.assetsDir}${sanitizedFilename}`;
		});
		const validImagePaths = imagePaths.filter(
			(p): p is string => p !== null,
		);

		const imagesToDelete = getUnusedImages(
			app,
			validImagePaths,
			file,
			settings,
		);

		const allPathsToDelete = [path, ...imagesToDelete];

		const commitMsg = `obsidian: deleted ${path}${imagesToDelete.length > 0 ? ` and ${imagesToDelete.length} unused image(s)` : ""} at ${new Date().toISOString()}`;
		await githubDeleteFiles(allPathsToDelete, settings, PAT, commitMsg);

		const msg =
			imagesToDelete.length > 0
				? `Unpublished ${file.name} and deleted ${imagesToDelete.length} unused image${imagesToDelete.length === 1 ? "" : "s"}`
				: `Unpublished ${file.name}`;
		new Notice(msg);
	} catch (error: unknown) {
		let errorMsg;
		if (error instanceof Error && error.message) {
			errorMsg = error.message;
		} else if (typeof error === "string") {
			errorMsg = error;
		}
		new Notice(`Failed to unpublish ${file.name}: ${errorMsg}`);
		throw error;
	}
}
