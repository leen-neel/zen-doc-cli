import { writeFile, copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import type { FileInfo } from "./fileRead.js";
import {
  getCategoryTitle,
  getActionFromRoute,
  getUniqueFileName,
} from "./fileUtils.js";
import {
  getRouteFromPath,
  getHttpMethodFromFile,
} from "./contentProcessing.js";

export async function createAstroProject(
  outputDir: string,
  config: any
): Promise<void> {
  console.log(chalk.cyan(`🔍 Checking Astro project at: ${outputDir}`));

  try {
    // Check if Astro project already exists by looking for package.json and astro.config.mjs
    const packageJsonPath = join(outputDir, "package.json");
    const astroConfigPath = join(outputDir, "astro.config.mjs");

    const hasPackageJson = existsSync(packageJsonPath);
    const hasAstroConfig = existsSync(astroConfigPath);

    console.log(chalk.gray(`   Has package.json: ${hasPackageJson}`));
    console.log(chalk.gray(`   Has astro.config.mjs: ${hasAstroConfig}`));

    if (hasPackageJson && hasAstroConfig) {
      console.log(
        chalk.blue("📁 Astro project already exists, using existing project")
      );
      return;
    }

    // If directory exists but doesn't have Astro files, warn user
    if (existsSync(outputDir) && !hasPackageJson) {
      console.log(
        chalk.yellow(
          `⚠️  Directory ${outputDir} exists but is not an Astro project`
        )
      );
      console.log(
        chalk.yellow("Creating new Astro project in this directory...")
      );
    }

    console.log(
      chalk.cyan(
        `🚀 Creating new Astro project with Starlight in ${outputDir}...`
      )
    );

    // Create Astro project with Starlight template
    execSync(
      `npm create astro@latest ${outputDir} -- --template starlight --yes --no-git`,
      { stdio: "inherit" }
    );

    console.log(chalk.green("✅ Astro project created successfully"));
  } catch (error) {
    console.error(chalk.red("❌ Failed to create Astro project:"));
    console.error(chalk.red(error));
    process.exit(1);
  }
}

export async function generateAstroConfig(
  grouped: Record<string, FileInfo[]>,
  config: any,
  tempDir: string
): Promise<void> {
  console.log(chalk.cyan("⚙️  Generating Astro configuration..."));

  const sidebarConfig = generateSidebarConfig(grouped);

  const astroConfig = `import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: '${config.projectName}',
      description: '${config.description || "Project documentation"}',
      favicon: '/favicon.svg',
      sidebar: ${JSON.stringify(sidebarConfig, null, 2)},
    }),
  ],
  server: {
    port: 4321,
  },
});
`;

  await writeFile(join(tempDir, "astro.config.mjs"), astroConfig, "utf-8");
  console.log(chalk.green("✅ Astro configuration generated"));
}

export function generateSidebarConfig(
  grouped: Record<string, FileInfo[]>
): any[] {
  const sidebar: any[] = [];

  // Add category sections
  for (const [category, files] of Object.entries(grouped)) {
    if (files.length === 0) continue;

    const categoryTitle = getCategoryTitle(category);
    const categoryItems = files.map((file) => {
      // Get the actual filename without extension (this matches what getUniqueFileName produces)
      const actualFileName = getUniqueFileName(file, category).replace(
        /\.md$/,
        ""
      );

      return {
        label: file.fileName.replace(/\.[^/.]+$/, ""), // Original filename for display
        slug: `${category}/${actualFileName}`,
      };
    });

    sidebar.push({
      label: categoryTitle,
      items: categoryItems,
    });
  }

  return sidebar;
}

export async function moveContentToAstroProject(
  tempDir: string,
  outputDir: string
): Promise<void> {
  console.log(chalk.cyan("📦 Moving generated content to Astro project..."));
  console.log(chalk.gray(`   Temp directory: ${tempDir}`));
  console.log(chalk.gray(`   Output directory: ${outputDir}`));

  try {
    // Check if temp directory exists
    if (!existsSync(tempDir)) {
      console.error(chalk.red(`❌ Temp directory does not exist: ${tempDir}`));
      process.exit(1);
    }

    // Copy content directory - Starlight uses src/content/docs
    const sourceContentDir = join(tempDir, "content");
    const targetContentDir = join(outputDir, "src/content/docs");

    console.log(chalk.gray(`   Source content dir: ${sourceContentDir}`));
    console.log(chalk.gray(`   Target content dir: ${targetContentDir}`));

    // Check if source content exists
    if (!existsSync(sourceContentDir)) {
      console.error(
        chalk.red(
          `❌ Source content directory does not exist: ${sourceContentDir}`
        )
      );
      process.exit(1);
    }

    // Delete existing content directory if it exists
    if (existsSync(targetContentDir)) {
      console.log(chalk.yellow("🗑️  Removing existing content directory..."));
      execSync(`rm -rf "${targetContentDir}"`, { stdio: "inherit" });
    }

    // Ensure the target directory exists
    await mkdir(targetContentDir, { recursive: true });

    // Copy docs from temp directory to target
    console.log(chalk.blue("📋 Copying generated docs..."));
    execSync(`cp -r "${sourceContentDir}/docs/." "${targetContentDir}/"`, {
      stdio: "inherit",
    });

    // Copy Astro config
    const sourceConfig = join(tempDir, "astro.config.mjs");
    const targetConfig = join(outputDir, "astro.config.mjs");
    await copyFile(sourceConfig, targetConfig);

    // Clean up temp directory
    console.log(chalk.blue("🧹 Cleaning up temporary files..."));
    execSync(`rm -rf "${tempDir}"`, { stdio: "inherit" });

    console.log(chalk.green("✅ Content moved successfully"));
  } catch (error) {
    console.error(chalk.red("❌ Failed to move content:"));
    console.error(chalk.red(error));
    process.exit(1);
  }
}

export async function generateCategoryIndexes(
  grouped: Record<string, FileInfo[]>,
  baseDir: string
): Promise<void> {
  console.log(chalk.cyan("📋 Generating category index files..."));

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

  console.log(chalk.green("✅ Category indexes generated"));
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
