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
```

No automated tests exist. Manual testing: copy `main.js`, `manifest.json`, `styles.css` into a vault at `<Vault>/.obsidian/plugins/sample-plugin/`, reload Obsidian, enable the plugin.

## Architecture

```
src/
  main.ts       Plugin lifecycle: onload/onunload, command registration, settings tab
  publish.ts    GitHub publishing logic via Octokit (publishSingleFile, unpublishSingleFile, image extraction)
  settings.ts   MyPluginSettings interface (owner, repo, gitPAT) and settings tab UI
```

- **main.ts** registers four commands: `publish-current-page`, `unpublish-current-page`, `publish-all`, `replace-selected`. It uses frontmatter fields `pb-publish` and `pb-type` to control publishing.
- **publish.ts** uses `octokit-commit-multiple-files` to batch-commit a note and its embedded images to a configurable GitHub repo.
- **settings.ts** defines plugin settings and the settings tab with inputs for GitHub owner, repo name, and personal access token.

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
