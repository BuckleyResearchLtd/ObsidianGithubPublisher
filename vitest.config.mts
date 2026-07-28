import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const resolvePath = (relative: string) =>
	fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
	},
	resolve: {
		alias: [
			{
				find: /^obsidian$/,
				replacement: resolvePath("./tests/mocks/obsidian.ts"),
			},
			{
				find: /^settings$/,
				replacement: resolvePath("./src/settings.ts"),
			},
		],
	},
});
