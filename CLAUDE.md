# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Obsidian community plugin that publishes markdown notes (with embedded images) to a GitHub repository via the Octokit SDK. TypeScript source is bundled with esbuild into a single `main.js` loaded by Obsidian.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Watch mode (esbuild, auto-rebuild on change)
npm run build        # Type-check (tsc --noEmit) then production bundle
npm run lint         # ESLint (flat config, includes obsidianmd plugin)
npm test             # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
```

Tests live in `tests/`. `obsidian` ships no runtime JS, so it is aliased to `tests/mocks/obsidian.ts` in `vitest.config.mts`; `@octokit/rest` is mocked per-test. `tests/bundle.test.ts` builds `main.js` and asserts it references no Node-only globals — this is what keeps the plugin working on Obsidian mobile, which has no Node runtime.

Manual testing: copy `main.js` and `manifest.json` into a vault at `<Vault>/.obsidian/plugins/github-publisher/`, reload Obsidian, enable the plugin.

## Architecture

```
src/
  main.ts       Plugin lifecycle: onload/onunload, command registration, settings tab
  publish.ts    GitHub publishing logic via Octokit (publishSingleFile, unpublishSingleFile, image extraction)
  settings.ts   GitHubPublisherSettings interface and settings tab UI
```

- **main.ts** registers two commands, `publish-current-page` and `unpublish-current-page`, plus a ribbon icon for each. It uses frontmatter fields `pb-publish` and `pb-type` to control publishing.
- **publish.ts** commits a note and its embedded images through the GitHub Git Data API (blob → tree → commit → ref) so each publish is one atomic commit. Markdown blobs are sent with `encoding: "utf-8"`, images with `encoding: "base64"`.
- **settings.ts** defines plugin settings and the settings tab with inputs for GitHub owner, repo name, personal access token, branch, and content/asset paths.

Nothing in `src/` may use Node-only globals (`Buffer`, `process`, `require`) — Obsidian mobile has no Node runtime. See the mobile note under Commands.

## Build Details

- Bundler: esbuild (CJS output, ES2018 target)
- External modules (not bundled): `obsidian`, `electron`, `@codemirror/*`
- Output: `main.js` at project root
- TypeScript strict mode enabled

## Conventions

- Keep `main.ts` minimal (lifecycle only); delegate feature logic to separate modules.
- Use `this.register*` helpers for all listeners/intervals so cleanup is automatic on unload.
- Command IDs are stable; never rename after release.
- Plugin settings persisted via `this.loadData()` / `this.saveData()`.
- Prefer sentence case for UI text. Use `→` arrow notation for navigation paths.
- Indent with tabs (4-space width), LF line endings, UTF-8.
- Never add comments to code.
- Prefer early returns over if-else when reasonable.
