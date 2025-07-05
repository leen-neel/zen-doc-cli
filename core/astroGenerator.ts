import { writeFile, copyFile } from "fs/promises";
import { join } from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import type { FileInfo } from "./fileRead";
import { getCategoryTitle } from "./fileUtils";

export async function createAstroProject(
  outputDir: string,
  config: any
): Promise<void> {
  try {
    // Check if Astro project already exists
    const packageJsonPath = join(outputDir, "package.json");
    const packageJson = await import(packageJsonPath).catch(() => null);

    if (packageJson) {
      console.log(
        chalk.blue("📁 Astro project already exists, skipping creation")
      );
      return;
    }

    console.log(chalk.cyan("🚀 Creating new Astro project with Starlight..."));

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
      author: '${config.author}',
      favicon: '/favicon.svg',
      logo: {
        src: './src/assets/logo.svg',
        alt: '${config.projectName} logo',
      },
      social: {
        github: '${config.github || ""}',
      },
      sidebar: ${JSON.stringify(sidebarConfig, null, 2)},
      components: {
        PageTitle: './src/components/PageTitle.astro',
      },
      customCss: [
        './src/styles/custom.css',
      ],
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
  const sidebar: any[] = [
    {
      label: "Getting Started",
      items: [
        { label: "Introduction", link: "/" },
        { label: "Quick Start", link: "/quickstart/" },
      ],
    },
  ];

  // Add category sections
  for (const [category, files] of Object.entries(grouped)) {
    if (files.length === 0) continue;

    const categoryTitle = getCategoryTitle(category);
    const categoryItems = files.map((file) => {
      const fileName = file.fileName.replace(/\.[^/.]+$/, "");
      return {
        label: fileName,
        link: `/${category}/${fileName}/`,
      };
    });

    sidebar.push({
      label: categoryTitle,
      items: categoryItems,
    });
  }

  // Add reference section
  sidebar.push({
    label: "Reference",
    items: [
      { label: "API Reference", link: "/api-reference/" },
      { label: "Configuration", link: "/configuration/" },
    ],
  });

  return sidebar;
}

export async function moveContentToAstroProject(
  tempDir: string,
  outputDir: string
): Promise<void> {
  console.log(chalk.cyan("📦 Moving generated content to Astro project..."));

  try {
    // Copy content directory
    const sourceContentDir = join(tempDir, "content");
    const targetContentDir = join(outputDir, "src/content/docs");

    // Use cp command for better cross-platform compatibility
    execSync(`cp -r "${sourceContentDir}" "${targetContentDir}"`, {
      stdio: "inherit",
    });

    // Copy Astro config
    const sourceConfig = join(tempDir, "astro.config.mjs");
    const targetConfig = join(outputDir, "astro.config.mjs");
    await copyFile(sourceConfig, targetConfig);

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

    const indexPath = join(baseDir, category, "_index.md");
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
