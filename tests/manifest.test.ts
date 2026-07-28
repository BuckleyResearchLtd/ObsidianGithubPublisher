import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const readJson = (name: string): Record<string, unknown> =>
	JSON.parse(readFileSync(`${root}/${name}`, "utf8")) as Record<
		string,
		unknown
	>;

const manifest = readJson("manifest.json");
const versions = readJson("versions.json");
const pkg = readJson("package.json");

const SEMVER = /^\d+\.\d+\.\d+$/;
const MIN_APP_VERSION_FOR_PROCESS_FRONT_MATTER = "1.4.4";

function compareVersions(a: string, b: string): number {
	const left = a.split(".").map(Number);
	const right = b.split(".").map(Number);
	for (let i = 0; i < 3; i++) {
		const diff = (left[i] ?? 0) - (right[i] ?? 0);
		if (diff !== 0) {
			return diff;
		}
	}
	return 0;
}

describe("manifest.json", () => {
	it("has every field the community plugin list requires", () => {
		for (const field of [
			"id",
			"name",
			"version",
			"minAppVersion",
			"description",
			"author",
		]) {
			expect(manifest[field], `missing ${field}`).toBeTruthy();
		}
	});

	it("uses a kebab-case id without the word obsidian", () => {
		const id = manifest.id as string;
		expect(id).toMatch(/^[a-z0-9-]+$/);
		expect(id).not.toContain("obsidian");
	});

	it("uses a name without the words obsidian or plugin", () => {
		const name = manifest.name as string;
		expect(name.toLowerCase()).not.toContain("obsidian");
		expect(name.toLowerCase()).not.toContain("plugin");
	});

	it("keeps the description within the 250 character limit", () => {
		expect((manifest.description as string).length).toBeLessThanOrEqual(250);
	});

	it("claims mobile support", () => {
		expect(manifest.isDesktopOnly).toBe(false);
	});

	it("requires an app version new enough for processFrontMatter", () => {
		const minAppVersion = manifest.minAppVersion as string;
		expect(minAppVersion).toMatch(SEMVER);
		expect(
			compareVersions(
				minAppVersion,
				MIN_APP_VERSION_FOR_PROCESS_FRONT_MATTER,
			),
		).toBeGreaterThanOrEqual(0);
	});
});

describe("version metadata agrees across files", () => {
	it("uses a plain semver version", () => {
		expect(manifest.version as string).toMatch(SEMVER);
	});

	it("matches the package.json version", () => {
		expect(pkg.version).toBe(manifest.version);
	});

	it("records the current version in versions.json", () => {
		expect(versions[manifest.version as string]).toBe(
			manifest.minAppVersion,
		);
	});

	it("maps every entry in versions.json to a semver app version", () => {
		for (const [version, minApp] of Object.entries(versions)) {
			expect(version).toMatch(SEMVER);
			expect(minApp).toMatch(SEMVER);
		}
	});
});
