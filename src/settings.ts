import {App, PluginSettingTab, Setting} from "obsidian";
import GitHubPublisherPlugin from "./main";

export interface GitHubPublisherSettings {
	repo: string;
	owner: string;
	gitPAT: string;
	contentDir: string;
	assetsDir: string;
	assetsRelativePath: string;
	branch: string;
	usePostTypeSubdirectories: boolean;
}

export const DEFAULT_SETTINGS: GitHubPublisherSettings = {
	repo: '',
	owner: '',
	gitPAT: '',
	contentDir: 'src/content/',
	assetsDir: 'src/assets/',
	assetsRelativePath: '../../assets/',
	branch: 'main',
	usePostTypeSubdirectories: true,
};


export class GitHubPublisherSettingTab extends PluginSettingTab {
	plugin: GitHubPublisherPlugin;

	constructor(app: App, plugin: GitHubPublisherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('GitHub owner')
			.setDesc('Owner of the GitHub repository')
			.addText(text => text
				.setPlaceholder('e.g., owner in github.com/owner/repo')
				.setValue(this.plugin.settings.owner)
				.onChange(async (value) => {
					this.plugin.settings.owner = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('GitHub repository')
			.setDesc('Repository name')
			.addText(text => text
				.setPlaceholder('e.g., repo in github.com/owner/repo')
				.setValue(this.plugin.settings.repo)
				.onChange(async (value) => {
					this.plugin.settings.repo = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('GitHub pat')
			.setDesc('Personal access token with write permissions')
			.addText(text => text
				.setValue(this.plugin.settings.gitPAT)
				.onChange(async (value) => {
					this.plugin.settings.gitPAT = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Branch')
			.setDesc('Git branch to commit to')
			.addText(text => text
				.setValue(this.plugin.settings.branch)
				.onChange(async (value) => {
					this.plugin.settings.branch = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Content directory')
			.setDesc('Base content directory in your repository')
			.addText(text => text
				.setPlaceholder('./src/content/')
				.setValue(this.plugin.settings.contentDir)
				.onChange(async (value) => {
					this.plugin.settings.contentDir = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Assets directory')
			.setDesc('Directory where images are stored in your repository')
			.addText(text => text
				.setPlaceholder('./src/assets/')
				.setValue(this.plugin.settings.assetsDir)
				.onChange(async (value) => {
					this.plugin.settings.assetsDir = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Assets relative path')
			.setDesc('Relative path from content files to assets (used in Markdown image links)')
			.addText(text => text
				.setPlaceholder('../../assets/')
				.setValue(this.plugin.settings.assetsRelativePath)
				.onChange(async (value) => {
					this.plugin.settings.assetsRelativePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Use post type subdirectories')
			.setDesc('Organize content by post type in subdirectories (e.g., blog/, essays/). When off, files are published to the root of the content directory.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.usePostTypeSubdirectories)
				.onChange(async (value) => {
					this.plugin.settings.usePostTypeSubdirectories = value;
					await this.plugin.saveSettings();
				}));
	}
}
