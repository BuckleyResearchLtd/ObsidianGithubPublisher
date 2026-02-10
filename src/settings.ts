import {App, PluginSettingTab, SecretComponent, Setting} from "obsidian";
import MyPlugin from "./main";

export interface MyPluginSettings {
	repo: string;
	owner: string;
	gitPAT: string;
}


export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('git owner')
			.setDesc('Owner for the github repo in question')
			.addText(text => text
				.setPlaceholder('e.g https://github.com/{owner}/{repo}')
				.setValue(this.plugin.settings.owner)
				.onChange(async (value) => {
					this.plugin.settings.owner = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('git reo')
			.setDesc('Owner for the github repo in question')
			.addText(text => text
				.setPlaceholder('e.g https://github.com/{owner}/{repo}')
				.setValue(this.plugin.settings.repo)
				.onChange(async (value) => {
					this.plugin.settings.repo = value;
					await this.plugin.saveSettings();
				}));
			
		new Setting(containerEl)
			.setName('github PAT')
			.setDesc('PAT with write capabilities')
			// .addComponent(el => new SecretComponent(this.app, el)
			.addText(text => text
				.setValue(this.plugin.settings.gitPAT)
				.onChange(async (value) => {
					this.plugin.settings.gitPAT = value;
					await this.plugin.saveSettings();
				}));
	}
}
