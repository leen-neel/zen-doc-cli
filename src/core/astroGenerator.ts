import { writeFile, copyFile, mkdir, rm, readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import ora from "ora";
import type { FileInfo } from "./fileRead.js";
import {
  getCategoryTitle,
  getActionFromRoute,
  getUniqueFileName,
} from "./fileUtils.js";
import { getRouteFromPath } from "./contentProcessing.js";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

export async function createAstroProject(
  outputDir: string,
  config: any
): Promise<void> {
  const checkSpinner = ora(`Checking Astro project at: ${outputDir}`).start();

  try {
    // Check if Astro project already exists by looking for package.json and astro.config.mjs
    const packageJsonPath = join(outputDir, "package.json");
    const astroConfigPath = join(outputDir, "astro.config.mjs");

    const hasPackageJson = existsSync(packageJsonPath);
    const hasAstroConfig = existsSync(astroConfigPath);

    if (hasPackageJson && hasAstroConfig) {
      checkSpinner.succeed(
        "Astro project already exists, using existing project"
      );
      return;
    }

    // If directory exists but doesn't have Astro files, warn user
    if (existsSync(outputDir) && !hasPackageJson) {
      checkSpinner.warn(
        `Directory ${outputDir} exists but is not an Astro project`
      );
    }

    checkSpinner.text = `Creating new Astro project with Starlight in ${outputDir}...`;

    // Create Astro project with Starlight template (cross-platform)
    const command =
      process.platform === "win32"
        ? `npm create astro@latest "${outputDir}" -- --template starlight --yes --no-git`
        : `npm create astro@latest ${outputDir} -- --template starlight --yes --no-git`;

    execSync(command, { stdio: "inherit" });

    checkSpinner.succeed("Astro project created successfully");
  } catch (error) {
    checkSpinner.fail("Failed to create Astro project");
    console.error(chalk.red(error));
    process.exit(1);
  }
}

export async function generateAstroConfig(
  grouped: Record<string, FileInfo[]>,
  config: any,
  tempDir: string
): Promise<void> {
  const configSpinner = ora("Generating Astro configuration...").start();

  const sidebarConfig = await generateSidebarConfigWithAI(grouped);

  // Configure internationalization if translation is enabled
  const i18nConfig =
    config.useTranslation && config.languages && config.languages.length > 0
      ? `
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
        ${config.languages
          .map(
            (lang: string) => `${lang}: {
          label: '${getLanguageLabel(lang)}',
          lang: '${lang}',
        }`
          )
          .join(",\n        ")}
      },`
      : "";

  const astroConfig = `import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: '${config.projectName}',
      description: '${config.description || "Project documentation"}',
      favicon: '/favicon.svg',
      sidebar: ${JSON.stringify(sidebarConfig, null, 2)},${i18nConfig}
    }),
  ],
  server: {
    port: 4321,
  },
});
`;

  await writeFile(join(tempDir, "astro.config.mjs"), astroConfig, "utf-8");
  configSpinner.succeed("Astro configuration generated");
}

/**
 * Get human-readable language label
 */
function getLanguageLabel(langCode: string): string {
  const languageLabels: Record<string, string> = {
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    it: "Italiano",
    pt: "Português",
    ru: "Русский",
    ja: "日本語",
    ko: "한국어",
    zh: "中文",
    ar: "العربية",
    hi: "हिन्दी",
    nl: "Nederlands",
    sv: "Svenska",
    da: "Dansk",
    no: "Norsk",
    fi: "Suomi",
    pl: "Polski",
    tr: "Türkçe",
    cs: "Čeština",
    sk: "Slovenčina",
    hu: "Magyar",
    ro: "Română",
    bg: "Български",
    hr: "Hrvatski",
    sl: "Slovenščina",
    et: "Eesti",
    lv: "Latviešu",
    lt: "Lietuvių",
    mt: "Malti",
    ga: "Gaeilge",
    cy: "Cymraeg",
  };

  return languageLabels[langCode] || langCode.toUpperCase();
}

/**
 * Check if a directory contains language subdirectories
 */
async function checkForLanguageDirectories(dir: string): Promise<boolean> {
  try {
    const { readdir, stat } = await import("fs/promises");
    const items = await readdir(dir);

    for (const item of items) {
      const itemPath = join(dir, item);
      const stats = await stat(itemPath);

      if (stats.isDirectory()) {
        // Check if this looks like a language directory (2-3 letter codes)
        if (/^[a-z]{2,3}$/.test(item)) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error(`Error checking for language directories in ${dir}:`, error);
    return false;
  }
}

export async function generateSidebarConfigWithAI(
  grouped: Record<string, FileInfo[]>
): Promise<any[]> {
  const sidebar: any[] = [];

  for (const [category, files] of Object.entries(grouped)) {
    if (files.length === 0) continue;

    const categoryTitle = getCategoryTitle(category);
    const categoryItems = await Promise.all(
      files.map(async (file) => {
        const actualFileName = getUniqueFileName(file, category).replace(
          /\.md$/,
          ""
        );
        let label = file.fileName.replace(/\.[^/.]+$/, "");
        try {
          // Use up to 20 lines of file content for context
          const snippet = file.content.split("\n").slice(0, 20).join("\n");
          let prompt;
          if (category === "api") {
            prompt = `Given the following file path and code, generate a short, human-friendly label for a documentation sidebar. If this is an API route, infer the HTTP method (GET, POST, etc.) and show the public route path, e.g., GET /api/tasks. Do not use any formatting. File path: ${file.relativePath}\nCode:\n\n${snippet}\n\nLabel:`;
          } else {
            prompt = `Given the following file path and code, generate a short, human-friendly label for a documentation sidebar. Do not use any sort of bold, italic, or other formatting. File path: ${file.relativePath}\nCode:\n\n${snippet}\n\nLabel:`;
          }
          const result = await generateText({
            model: google("gemini-2.0-flash"),
            prompt,
            maxTokens: 30,
            temperature: 0.2,
          });
          label = result.text.trim().replace(/^"|"$/g, "");
        } catch (e) {
          // fallback: clean up file/route name
          if (category === "api" || category === "pages") {
            let route = getRouteFromPath(file.relativePath);
            if (route.startsWith("/app/")) route = route.replace(/^\/app/, "");
            if (route.endsWith("/route")) route = route.replace(/\/route$/, "");
            label = route;
          }
        }
        return {
          label,
          slug: `${category}/${actualFileName}`,
        };
      })
    );
    sidebar.push({
      label: categoryTitle,
      items: categoryItems,
    });
  }
  return sidebar;
}

// Cross-platform directory copy function
async function copyDirectory(
  source: string,
  destination: string
): Promise<void> {
  // Create destination directory if it doesn't exist
  await mkdir(destination, { recursive: true });

  // Read all items in the source directory
  const items = await readdir(source);

  for (const item of items) {
    const sourcePath = join(source, item);
    const destPath = join(destination, item);

    const stats = await stat(sourcePath);

    if (stats.isDirectory()) {
      // Recursively copy subdirectories
      await copyDirectory(sourcePath, destPath);
    } else {
      // Copy files
      await copyFile(sourcePath, destPath);
    }
  }
}

export async function moveContentToAstroProject(
  tempDir: string,
  outputDir: string
): Promise<void> {
  const moveSpinner = ora(
    "Moving generated content to Astro project..."
  ).start();

  try {
    // Check if temp directory exists
    if (!existsSync(tempDir)) {
      moveSpinner.fail(`Temp directory does not exist: ${tempDir}`);
      process.exit(1);
    }

    // Copy content directory - Starlight uses src/content/docs
    const sourceContentDir = join(tempDir, "content");
    const targetContentDir = join(outputDir, "src/content/docs");

    // Check if source content exists
    if (!existsSync(sourceContentDir)) {
      moveSpinner.fail(
        `Source content directory does not exist: ${sourceContentDir}`
      );
      process.exit(1);
    }

    // Delete existing content directory if it exists
    if (existsSync(targetContentDir)) {
      moveSpinner.text = "Removing existing content directory...";
      await rm(targetContentDir, { recursive: true, force: true });
    }

    // Ensure the target directory exists
    await mkdir(targetContentDir, { recursive: true });

    // Copy docs from temp directory to target using Node.js APIs
    moveSpinner.text = "Copying generated docs...";

    // Check if we have language subdirectories (translation enabled)
    const docsSourceDir = join(sourceContentDir, "docs");
    const hasLanguageDirs = await checkForLanguageDirectories(docsSourceDir);

    if (hasLanguageDirs) {
      // Copy each language directory
      const { readdir, stat } = await import("fs/promises");
      const items = await readdir(docsSourceDir);

      for (const item of items) {
        const sourceItemPath = join(docsSourceDir, item);
        const targetItemPath = join(targetContentDir, item);

        // Check if it's a directory before copying
        const stats = await stat(sourceItemPath);
        if (stats.isDirectory()) {
          await copyDirectory(sourceItemPath, targetItemPath);
        } else if (stats.isFile()) {
          // Copy individual files (like index.mdx) directly
          await copyFile(sourceItemPath, targetItemPath);
        }
      }
    } else {
      // Copy docs directly (no translation)
      await copyDirectory(docsSourceDir, targetContentDir);
    }

    // Copy Astro config
    moveSpinner.text = "Copying Astro configuration...";
    const sourceConfig = join(tempDir, "astro.config.mjs");
    const targetConfig = join(outputDir, "astro.config.mjs");
    await copyFile(sourceConfig, targetConfig);

    // Clean up temp directory
    moveSpinner.text = "Cleaning up temporary files...";
    await rm(tempDir, { recursive: true, force: true });

    moveSpinner.succeed("Content moved successfully");
  } catch (error) {
    moveSpinner.fail("Failed to move content");
    console.error(chalk.red(error));
    process.exit(1);
  }
}

export async function generateCategoryIndexes(
  grouped: Record<string, FileInfo[]>,
  baseDir: string
): Promise<void> {
  const indexSpinner = ora("Generating category index files...").start();

  for (const [category, files] of Object.entries(grouped)) {
    if (files.length === 0) continue;

    const categoryTitle = getCategoryTitle(category);
    const categoryDescription = getCategoryDescription(category);

    let content = `---
title: ${categoryTitle}
description: ${categoryDescription}
---

# ${categoryTitle}

${categoryDescription}

## Files

`;

    // Add links to each file
    for (const file of files) {
      const fileName = file.fileName.replace(/\.[^/.]+$/, "");
      const filePath = `./${fileName}`;
      content += `- [${fileName}](${filePath}) - ${getFileDescription(
        file,
        category
      )}\n`;
    }

    content += `

## Overview

This section contains documentation for all ${category} files in the project. Each file is automatically documented with detailed information about its purpose, usage, and implementation.

`;

    const indexPath = join(baseDir, category, "index.md");
    await writeFile(indexPath, content, "utf-8");
  }

  indexSpinner.succeed("Category indexes generated");
}

function getCategoryDescription(category: string): string {
  const descriptions = {
    components: "Reusable UI components used throughout the application.",
    pages: "Page components and routing logic.",
    api: "API endpoints and server-side logic.",
    lib: "Utility functions, helpers, and shared libraries.",
  };

  return descriptions[category as keyof typeof descriptions] || "";
}

function getFileDescription(file: FileInfo, category: string): string {
  const baseName = file.fileName.replace(/\.[^/.]+$/, "");

  switch (category) {
    case "components":
      return `${baseName} component - A reusable UI component`;
    case "pages":
      return `${baseName} page - Application page component`;
    case "api":
      return `${baseName} API endpoint - Server-side API route`;
    case "lib":
      return `${baseName} utility - Helper functions and utilities`;
    default:
      return `Documentation for ${baseName}`;
  }
}
