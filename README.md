# GitHub Publisher

Publish markdown notes and images from Obsidian to GitHub repositories. The plugin supports content collections and handles image uploads automatically.

If you don't know what your doing, this probably isn't for you. I'd recommend using the [Obsidian Digital Garden](https://dg-docs.ole.dev/) plugin instead. It does pretty much the same thing, however because I'd already built a site using Astro, making it work for my use case was harder than writing my own from scratch, but that plugin is basically this one but better.

## Features

The plugin publishes markdown files to a GitHub repository. It converts Obsidian wikilinks to standard markdown syntax. Images embedded in notes are uploaded to a specified assets directory. The plugin can organize content by post type in subdirectories or publish to a flat structure.

Files are published when the `pb-publish` frontmatter field is set to `true`. The `pb-type` field determines the content subdirectory. Both fields are required.

Images are tracked across all published notes. When unpublishing a note, images used only by that note are deleted. Images shared by other published notes are preserved.

## Installation

### From Obsidian Community Plugins

Search for "GitHub Publisher" in the Obsidian community plugins browser. Install and enable the plugin.

### Manual Installation

Copy `main.js` and `manifest.json` to your vault's plugin directory at `.obsidian/plugins/github-publisher/`.

## Configuration

The plugin requires a GitHub personal access token with repository write permissions. Configure the following settings:

### Required Settings

- **GitHub Owner**: Repository owner username
- **GitHub Repository**: Repository name
- **GitHub personal access token**: Token with write access to the repository
- **Branch**: Target branch for commits (default: `main`)

### Path Settings

- **Content Directory**: Base directory for markdown files (default: `src/content/`)
- **Assets Directory**: Directory for images (default: `src/assets/`)
- **Assets Relative Path**: Relative path from content to assets (default: `../../assets/`)

### Structure Settings

- **Use Post Type Subdirectories**: Organize content by post type (default: enabled)

When enabled, files are published to `{contentDir}/{postType}/{filename}`. When disabled, files are published to `{contentDir}/{filename}`.

## Usage

### Publishing a Note

Add frontmatter to your note:

```yaml
---
pb-publish: true
pb-type: blog
---
```

Run the command "Publish current page" from the command palette.

The plugin uploads the markdown file and any embedded images. It converts image wikilinks to relative paths. Frontmatter image references use plain paths. Content image references use markdown syntax.

### Unpublishing a Note

Run the command "Unpublish current page" from the command palette.

The plugin deletes the markdown file from GitHub. It checks all other published notes for image usage. Images not used elsewhere are deleted. Shared images are preserved.

### Frontmatter Image Links

Images in frontmatter are supported:

```yaml
---
cover: [[hero-image.png]]
---
```

The plugin converts these to paths:

```yaml
---
cover: ../../assets/hero-image.png
---
```

## Commands

- **Publish current page**: Publishes the active note
- **Unpublish current page**: Removes the active note from GitHub

## How It Works

The plugin uses the GitHub API through Octokit. All file operations are batched into single atomic commits. Image filenames are sanitized by replacing spaces with hyphens.

When publishing, the plugin:
1. Reads the frontmatter and content
2. Resolves all image wikilinks to actual files
3. Transforms wikilinks to relative paths or markdown syntax
4. Uploads each file as a git blob, markdown as UTF-8 and images as base64
5. Creates a single commit containing the markdown file and all images

When unpublishing, the plugin:
1. Identifies the file to delete
2. Collects all images embedded in the file
3. Checks other published notes for image usage
4. Deletes the file and unused images in a single commit

## Requirements

- Obsidian v1.4.4 or higher
- GitHub repository with write access
- GitHub personal access token

## Development

Install dependencies:

```bash
npm install
```

Build the plugin:

```bash
npm run build
```

Run in development mode:

```bash
npm run dev
```

Lint the code:

```bash
npm run lint
```

Run the tests:

```bash
npm test
```

## License

0-BSD
