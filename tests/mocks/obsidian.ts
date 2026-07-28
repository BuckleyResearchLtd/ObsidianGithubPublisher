export const noticeMessages: string[] = [];

export class Notice {
	constructor(message: string) {
		noticeMessages.push(message);
	}
}

export class TFile {
	path = "";
	name = "";
}

export class App { }

export class Plugin { }

export class PluginSettingTab { }

export class Setting { }
