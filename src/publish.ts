import { App, TFile } from 'obsidian';
import { MyPluginSettings } from 'settings';
import { Octokit } from "octokit";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";
// https://github.com/octokit/plugin-create-or-update-text-file.js/
const MyOctokit = Octokit.plugin(createOrUpdateTextFile);

export async function publishSingleFile(file: TFile, text: string, settings: MyPluginSettings, PAT: string, postType: string) {
	const path = `src/content/${postType}/${file.name}`;
	const commitMsg = `obsidian: create or update ${path} at ${new Date()}`;
	await githubPostFile(text, path, settings, PAT, commitMsg);
}

async function githubPostFile(text: string, path: string, settings: MyPluginSettings, PAT: string, commitMsg: string) {
	const octokit = new MyOctokit({ auth: PAT }); 
	const res = await octokit.createOrUpdateTextFile({ owner: settings.owner, repo: settings.repo, path: path, message: commitMsg , content: text})
	console.log("res", res)
	//todo give feedback
}

function getSHAOrNone(octokit: Octkit, path: string, owner: string, repo: string) {
	return octokit.rest.repos.getContent({ owner, repo, path })
		.then(res => res?.data?.sha)
		.catch(err => {
			console.log(err);
			return null;
		});
}


export async function unpublishSingleFile(file: TFile, text: string, settings: MyPluginSettings, PAT: string, postType: string) {
	const path = `src/content/${postType}/${file.name}`;
	const commitMsg = `obsidian: deleted ${path} at ${new Date()}`;
	await githubPostFile(null, path, settings, PAT, commitMsg);
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
