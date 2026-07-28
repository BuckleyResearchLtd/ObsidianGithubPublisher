import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
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
	autoPublish: boolean;
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
	autoPublish: false,
};

type TextSettingKey =
	| "owner"
	| "repo"
	| "gitPAT"
	| "branch"
	| "contentDir"
	| "assetsDir"
	| "assetsRelativePath";

type ToggleSettingKey = "usePostTypeSubdirectories" | "autoPublish";

type SettingField =
	| {
		type: "text" | "password";
		key: TextSettingKey;
		name: string;
		desc: string;
		placeholder?: string;
	}
	| {
		type: "toggle";
		key: ToggleSettingKey;
		name: string;
		desc: string;
	};

export const SETTING_FIELDS: SettingField[] = [
	{
		type: "text",
		key: "owner",
		name: "GitHub owner",
		desc: "Owner of the GitHub repository",
		placeholder: "e.g., owner in github.com/owner/repo",
	},
	{
		type: "text",
		key: "repo",
		name: "GitHub repository",
		desc: "Repository name",
		placeholder: "e.g., repo in github.com/owner/repo",
	},
	{
		type: "password",
		key: "gitPAT",
		name: "GitHub personal access token",
		desc: "Token with write permissions for the repository",
	},
	{
		type: "text",
		key: "branch",
		name: "Branch",
		desc: "Git branch to commit to",
	},
	{
		type: "text",
		key: "contentDir",
		name: "Content directory",
		desc: "Base content directory in your repository",
		placeholder: "./src/content/",
	},
	{
		type: "text",
		key: "assetsDir",
		name: "Assets directory",
		desc: "Directory where images are stored in your repository",
		placeholder: "./src/assets/",
	},
	{
		type: "text",
		key: "assetsRelativePath",
		name: "Assets relative path",
		desc: "Relative path from content files to assets (used in Markdown image links)",
		placeholder: "../../assets/",
	},
	{
		type: "toggle",
		key: "usePostTypeSubdirectories",
		name: "Use post type subdirectories",
		desc: "Organize content by post type in subdirectories (e.g., blog/, essays/). When off, files are published to the root of the content directory.",
	},
	{
		type: "toggle",
		key: "autoPublish",
		name: "Auto-publish",
		desc: "When on, the publish command will always publish the current file. When off, the publish command will only publish files that explicitly have pb-publish set to true in the frontmatter.",
	},
];

export class GitHubPublisherSettingTab extends PluginSettingTab {
	plugin: GitHubPublisherPlugin;

	constructor(app: App, plugin: GitHubPublisherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as keyof GitHubPublisherSettings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const settings = this.plugin.settings as unknown as Record<
			string,
			unknown
		>;
		settings[key] = value;
		await this.plugin.saveSettings();
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return SETTING_FIELDS.map((field) => {
			if (field.type === "toggle") {
				return {
					name: field.name,
					desc: field.desc,
					control: { type: "toggle" as const, key: field.key },
				};
			}

			if (field.type === "password") {
				return {
					name: field.name,
					desc: field.desc,
					render: (setting: Setting) => {
						this.addSecretText(setting, field.key);
					},
				};
			}

			return {
				name: field.name,
				desc: field.desc,
				control: {
					type: "text" as const,
					key: field.key,
					placeholder: field.placeholder,
				},
			};
		});
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		for (const field of SETTING_FIELDS) {
			const setting = new Setting(containerEl)
				.setName(field.name)
				.setDesc(field.desc);

			if (field.type === "toggle") {
				const key = field.key;
				setting.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings[key])
						.onChange(async (value) => {
							this.plugin.settings[key] = value;
							await this.plugin.saveSettings();
						}),
				);
				continue;
			}

			if (field.type === "password") {
				this.addSecretText(setting, field.key);
				continue;
			}

			const key = field.key;
			const placeholder = field.placeholder;
			setting.addText((text) => {
				if (placeholder) {
					text.setPlaceholder(placeholder);
				}
				return text
					.setValue(this.plugin.settings[key])
					.onChange(async (value) => {
						this.plugin.settings[key] = value;
						await this.plugin.saveSettings();
					});
			});
		}
	}

	private addSecretText(setting: Setting, key: TextSettingKey) {
		setting.addText((text) => {
			text.inputEl.type = "password";
			return text
				.setValue(this.plugin.settings[key])
				.onChange(async (value) => {
					this.plugin.settings[key] = value;
					await this.plugin.saveSettings();
				});
		});
	}
}
