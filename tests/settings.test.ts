import { describe, expect, it, beforeEach, vi } from "vitest";
import { recordedSettings, Setting } from "./mocks/obsidian";
import {
	DEFAULT_SETTINGS,
	GitHubPublisherSettings,
	GitHubPublisherSettingTab,
	SETTING_FIELDS,
} from "../src/settings";
import type GitHubPublisherPlugin from "../src/main";

type ControlDefinition = {
	name: string;
	desc?: string;
	control?: { type: string; key: string; placeholder?: string };
	render?: unknown;
};

const saveSettings = vi.fn();

function createTab(overrides: Partial<GitHubPublisherSettings> = {}) {
	const plugin = {
		settings: { ...DEFAULT_SETTINGS, ...overrides },
		saveSettings,
	} as unknown as GitHubPublisherPlugin;

	const tab = new GitHubPublisherSettingTab(
		{} as never,
		plugin,
	);
	return { tab, plugin };
}

function definitions(tab: GitHubPublisherSettingTab): ControlDefinition[] {
	return tab.getSettingDefinitions() as unknown as ControlDefinition[];
}

function renderLegacy(tab: GitHubPublisherSettingTab) {
	(tab as unknown as { display: () => void }).display();
}

beforeEach(() => {
	saveSettings.mockClear();
	recordedSettings.length = 0;
});

describe("declarative settings (Obsidian 1.13+)", () => {
	it("exposes every stored setting so none is missing from search", () => {
		const { tab } = createTab();

		const covered = definitions(tab).map((definition, index) => {
			const field = SETTING_FIELDS[index];
			return definition.control?.key ?? field?.key;
		});

		expect(new Set(covered)).toEqual(new Set(Object.keys(DEFAULT_SETTINGS)));
	});

	it("gives every definition a name and description", () => {
		const { tab } = createTab();

		for (const definition of definitions(tab)) {
			expect(definition.name).toBeTruthy();
			expect(definition.desc).toBeTruthy();
		}
	});

	it("maps toggles and text fields to the right control types", () => {
		const { tab } = createTab();
		const byName = new Map(
			definitions(tab).map((definition) => [definition.name, definition]),
		);

		expect(byName.get("Auto-publish")?.control).toMatchObject({
			type: "toggle",
			key: "autoPublish",
		});
		expect(byName.get("GitHub owner")?.control).toMatchObject({
			type: "text",
			key: "owner",
			placeholder: "e.g., owner in github.com/owner/repo",
		});
	});

	it("renders the token itself rather than exposing it as a text control", () => {
		const { tab } = createTab();
		const token = definitions(tab).find(
			(definition) => definition.name === "GitHub personal access token",
		);

		expect(token?.control).toBeUndefined();
		expect(typeof token?.render).toBe("function");
	});

	it("keeps the token masked when the framework renders it", () => {
		const { tab } = createTab({ gitPAT: "secret-token" });
		const token = definitions(tab).find(
			(definition) => definition.name === "GitHub personal access token",
		);

		const setting = new Setting({}) as never;
		(token?.render as (s: never) => void)(setting);

		expect(recordedSettings[0]?.controls[0]).toMatchObject({
			kind: "text",
			inputType: "password",
			value: "secret-token",
		});
	});

	it("reads control values from plugin settings", () => {
		const { tab } = createTab({ owner: "me", usePostTypeSubdirectories: false });

		expect(tab.getControlValue("owner")).toBe("me");
		expect(tab.getControlValue("usePostTypeSubdirectories")).toBe(false);
	});

	it("writes control values back and persists them", async () => {
		const { tab, plugin } = createTab();

		await tab.setControlValue("branch", "develop");

		expect(plugin.settings.branch).toBe("develop");
		expect(saveSettings).toHaveBeenCalledTimes(1);
	});
});

describe("imperative settings (Obsidian below 1.13)", () => {
	it("renders one row per field, in order", () => {
		const { tab } = createTab();
		renderLegacy(tab);

		expect(recordedSettings.map((setting) => setting.name)).toEqual(
			SETTING_FIELDS.map((field) => field.name),
		);
	});

	it("masks the token input", () => {
		const { tab } = createTab({ gitPAT: "secret-token" });
		renderLegacy(tab);

		const token = recordedSettings.find(
			(setting) => setting.name === "GitHub personal access token",
		);
		expect(token?.controls[0]).toMatchObject({
			kind: "text",
			inputType: "password",
			value: "secret-token",
		});
	});

	it("leaves other text inputs unmasked", () => {
		const { tab } = createTab({ owner: "me" });
		renderLegacy(tab);

		const owner = recordedSettings.find(
			(setting) => setting.name === "GitHub owner",
		);
		expect(owner?.controls[0]).toMatchObject({
			kind: "text",
			inputType: "text",
			value: "me",
		});
	});

	it("renders toggles for boolean settings", () => {
		const { tab } = createTab({ autoPublish: true });
		renderLegacy(tab);

		const toggle = recordedSettings.find(
			(setting) => setting.name === "Auto-publish",
		);
		expect(toggle?.controls[0]).toMatchObject({
			kind: "toggle",
			value: true,
		});
	});
});

describe("both render paths stay in sync", () => {
	it("covers the same named settings", () => {
		const { tab } = createTab();

		const declarative = definitions(tab).map((d) => d.name).sort();
		renderLegacy(tab);
		const imperative = recordedSettings
			.map((setting) => setting.name as string)
			.sort();

		expect(declarative).toEqual(imperative);
	});
});
