import { Notice, Plugin } from "obsidian";
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
			async () => await this.unpublishCurrentPage(),
		);

		this.addSettingTab(new GitHubPublisherSettingTab(this.app, this));
	}

	onunload() { }

	async publishCurrentPage() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file to publish");
			return;
		}
		let postType;
		let shouldPublish = false;
		await this.app.fileManager.processFrontMatter(
			activeFile,
			(frontmatter: Record<string, string | boolean>) => {
				if (this.settings.autoPublish) {
					frontmatter["pb-publish"] = true;
					shouldPublish = true;
					postType = frontmatter["pb-type"];
					return;
				}
				shouldPublish = frontmatter["pb-publish"] === true;
				postType = frontmatter["pb-type"];
			},
		);
		if (!postType) {
			new Notice("Not publishing: no pb-type set in frontmatter");
			return;
		}
		if (!shouldPublish) {
			new Notice("Not publishing: auto-publish is off and pb-publish is not set to true");
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
			new Notice("No active file to unpublish");
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
			new Notice("Not unpublishing: no pb-type set in frontmatter");
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
