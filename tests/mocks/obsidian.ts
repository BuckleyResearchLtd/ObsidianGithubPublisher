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

export type RecordedControl = {
	kind: "text" | "toggle";
	inputType?: string;
	placeholder?: string;
	value?: unknown;
};

export type RecordedSetting = {
	name?: string;
	desc?: string;
	controls: RecordedControl[];
};

export const recordedSettings: RecordedSetting[] = [];

export class TextComponent {
	inputEl = { type: "text" };
	value: unknown;
	placeholder?: string;
	changeHandler?: (value: string) => unknown;

	setValue(value: unknown) {
		this.value = value;
		return this;
	}

	setPlaceholder(placeholder: string) {
		this.placeholder = placeholder;
		return this;
	}

	onChange(handler: (value: string) => unknown) {
		this.changeHandler = handler;
		return this;
	}
}

export class ToggleComponent {
	value: unknown;
	changeHandler?: (value: boolean) => unknown;

	setValue(value: unknown) {
		this.value = value;
		return this;
	}

	onChange(handler: (value: boolean) => unknown) {
		this.changeHandler = handler;
		return this;
	}
}

export class Setting {
	record: RecordedSetting = { controls: [] };

	constructor(_containerEl: unknown) {
		recordedSettings.push(this.record);
	}

	setName(name: string) {
		this.record.name = name;
		return this;
	}

	setDesc(desc: string) {
		this.record.desc = desc;
		return this;
	}

	addText(cb: (component: TextComponent) => unknown) {
		const component = new TextComponent();
		cb(component);
		this.record.controls.push({
			kind: "text",
			inputType: component.inputEl.type,
			placeholder: component.placeholder,
			value: component.value,
		});
		return this;
	}

	addToggle(cb: (component: ToggleComponent) => unknown) {
		const component = new ToggleComponent();
		cb(component);
		this.record.controls.push({
			kind: "toggle",
			value: component.value,
		});
		return this;
	}
}

export class PluginSettingTab {
	app: unknown;
	containerEl = {
		empty: () => {
			recordedSettings.length = 0;
		},
	};

	constructor(app: unknown, _plugin: unknown) {
		this.app = app;
	}

	getControlValue(_key: string): unknown {
		return undefined;
	}

	setControlValue(_key: string, _value: unknown): void | Promise<void> {
		return undefined;
	}
}
