import { Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	GitHubPublisherSettings,
	GitHubPublisherSettingTab,
} from "./settings";
import { publishSingleFile, unpublishSingleFile } from "./publish";

export default class GitHubPublisherPlugin extends Plugin {
	settings: GitHubPublisherSettings;

	async onload() {
		await this.loadSettings();

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "publish-current-page",
			name: "Publish current page",
			callback: async () => await this.publishCurrentPage(),
		});

		this.addCommand({
			id: "unpublish-current-page",
			name: "Unpublish current page",
			callback: async () => await this.unpublishCurrentPage(),
		});

		this.addRibbonIcon(
			"megaphone",
			"Publish current page",
			async () => await this.publishCurrentPage(),
		);

		this.addRibbonIcon(
			"megaphone-off",
			"Unpublish current page",
			async () => await this.publishCurrentPage(),
		);

		this.addSettingTab(new GitHubPublisherSettingTab(this.app, this));
	}

	onunload() { }

	async publishCurrentPage() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			return;
		}
		let postType;
		await this.app.fileManager.processFrontMatter(
			activeFile,
			(frontmatter: Record<string, string | boolean>) => {
				frontmatter["pb-publish"] = true;
				postType = frontmatter["pb-type"];
			},
		);
		if (!postType) {
			return;
		}

		const pat = this.settings.gitPAT;
		const text = await this.app.vault.read(activeFile);
		await publishSingleFile(
			this.app,
			activeFile,
			text,
			this.settings,
			pat,
			postType,
		);
	}

	async unpublishCurrentPage() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			return;
		}
		let postType;
		await this.app.fileManager.processFrontMatter(
			activeFile,
			(frontmatter: Record<string, string | boolean>) => {
				frontmatter["pb-publish"] = false;
				postType = frontmatter["pb-type"];
			},
		);
		if (!postType) {
			return;
		}

		const pat = this.settings.gitPAT;
		await unpublishSingleFile(
			this.app,
			activeFile,
			this.settings,
			pat,
			postType,
		);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		) as GitHubPublisherSettings;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
