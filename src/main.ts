import {App, Editor, MarkdownView, Modal, Notice, Plugin, TFile} from 'obsidian';
import { MyPluginSettings, SampleSettingTab} from "./settings";
import { publishSingleFile, unpublishSingleFile } from './publish';

// Remember to rename these classes and interfaces!

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();


		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'publish-current-page',
			name: 'Publish current page',
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					return;
				}
				let postType;
				await this.app.fileManager.processFrontMatter(
					activeFile,
					(frontmatter) => {
						frontmatter["pb-publish"] = true;
						postType = frontmatter["pb-type"];
					},
				);
				if (!postType) {
					return;
				}

				const pat = this.settings.gitPAT;
				const text = await this.app.vault.read(activeFile);
				await publishSingleFile(this.app, activeFile, text, this.settings, pat, postType);
			}
		});

		this.addCommand({
			id: 'unpublish-current-page',
			name: 'Unpublish Current Page',
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					return;
				}
				let postType;
				await this.app.fileManager.processFrontMatter(
					activeFile,
					(frontmatter) => {
						frontmatter["pb-publish"] = false;
						postType = frontmatter["pb-type"];
					},
				);
				if (!postType) {
					return;
				}

				const pat = this.settings.gitPAT;
				await unpublishSingleFile(this.app, activeFile, this.settings, pat, postType);
			}
		});

		this.addCommand({
			id: 'publish-all',
			name: 'Publish All',
			callback: async () => {
				// publishAll(this.app);
				new Notice('Publish All is not yet implemented');
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'replace-selected',
			name: 'Replace selected content',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				editor.replaceSelection('Sample editor command');
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, {}, await this.loadData()) as MyPluginSettings;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
