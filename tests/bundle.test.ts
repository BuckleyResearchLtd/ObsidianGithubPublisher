import { describe, expect, it, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
let bundle = "";

beforeAll(() => {
	execFileSync("node", ["esbuild.config.mjs", "production"], {
		cwd: root,
		stdio: "pipe",
	});
	bundle = readFileSync(`${root}/main.js`, "utf8");
}, 120_000);

describe("bundle runs on the obsidian mobile runtime", () => {
	it("never references the node Buffer global", () => {
		const matches = bundle.match(/(?<![A-Za-z$_])Buffer(?![A-Za-z$_])/g);
		expect(matches ?? []).toEqual([]);
	});

	it("requires nothing but the obsidian module", () => {
		const requires = [
			...new Set(bundle.match(/require\(\s*"[^"]*"\s*\)/g) ?? []),
		];
		expect(requires).toEqual(['require("obsidian")']);
	});

	it("never references node-only module globals", () => {
		expect(bundle).not.toMatch(/(?<![A-Za-z$_])__dirname(?![A-Za-z$_])/);
		expect(bundle).not.toMatch(/(?<![A-Za-z$_])__filename(?![A-Za-z$_])/);
	});

	it("guards every access to the process global", () => {
		if (!/(?<![A-Za-z$_])process\./.test(bundle)) {
			return;
		}
		expect(bundle).toMatch(/typeof process\s*==\s*"object"/);
	});
});
