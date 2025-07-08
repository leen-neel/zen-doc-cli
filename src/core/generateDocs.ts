import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { loadConfig } from "../utils/loadConfig.ts";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import type { FileInfo } from "./fileRead.js";
import chalk from "chalk";
import ora from "ora";

// Import from modular files
import { getCategoryPrompt } from "./prompts.js";
import { addFrontmatter, generateDocStructure } from "./contentProcessing.js";
import {
  groupFilesByCategory,
  getUniqueFileName,
  filterEmptyCategories,
} from "./fileUtils.js";
import {
  generateIndexMdx,
  generateGettingStartedMdx,
} from "./indexGenerator.js";
import {
  createAstroProject,
  generateAstroConfig,
  moveContentToAstroProject,
  generateCategoryIndexes,
} from "./astroGenerator.js";
import { DocumentationTranslator } from "./translation.js";
import { loadEnvFile } from "../utils/loadenv.ts";


export async function generateDocs(fileInfos: FileInfo[]): Promise<void> {
  const config = await loadConfig();
  const outputDir = `./${config.outputDir}`;
  const tempDir = `./temp-zen-docs-${Date.now()}`;
  const baseDir = `${tempDir}/content/docs`;
  const { googleApiKey, lingoApiKey } = loadEnvFile();

  // Suppress any potential AI SDK logging
  process.env.AI_SDK_DEBUG = "false";

  // Validate API key is available
  if (googleApiKey === undefined) {
    console.error(
      chalk.red(
        "❌ Error: GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set"
      )
    );
    console.error(
      chalk.yellow("Please set your Google Gemini API key in your .env file:")
    );
    console.error(
      chalk.gray("GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here")
    );
    process.exit(1);
  }

  // Create Astro project with Starlight template if it doesn't exist
  const astroSpinner = ora({
    text: "Setting up Astro project...",
    color: "blue",
    spinner: "dots",
  }).start();
  await createAstroProject(outputDir, config);
  astroSpinner.succeed("Astro project setup complete");

  // Test AI connection
  const aiSpinner = ora({
    text: "Testing AI connection...",
    color: "yellow",
    spinner: "dots",
  }).start();
  try {
    const testResult = await generateText({
      model: google("gemini-2.0-flash"),
      prompt: "Say 'Hello, AI is working!'",
      maxTokens: 50,
    });
    aiSpinner.succeed("AI connection successful");
  } catch (error) {
    aiSpinner.fail("AI test failed");
    console.error(chalk.red(`❌ AI test failed: ${error}`));
    console.error(
      chalk.yellow(
        "Please check your GOOGLE_GENERATIVE_AI_API_KEY in your .env file"
      )
    );
    process.exit(1);
  }

  // Filter to only show the categories we care about
  const relevantCategories = ["components", "pages", "api", "lib"];
  const filteredFileInfos = fileInfos.filter((file) =>
    relevantCategories.includes(file.category)
  );

  // Group files by category
  const grouped = groupFilesByCategory(filteredFileInfos);

  // Filter out empty categories
  const nonEmptyGrouped = filterEmptyCategories(grouped);

  // Single spinner for the whole documentation generation
  const generateSpinner = ora({
    text: "Generating documentation...",
    color: "cyan",
    spinner: "dots",
  }).start();

  try {
    // Generate documentation for each category
    for (const [category, files] of Object.entries(nonEmptyGrouped)) {
      if (files.length === 0) continue;

      // Create category directory
      const categoryDir = join(baseDir, category);
      await mkdir(categoryDir, { recursive: true });

      // Generate docs for each file in the category
      for (const file of files) {
        try {
          const docContent = await generateFileDoc(file, category, config);
          const fileName = getUniqueFileName(file, category);
          const filePath = join(categoryDir, fileName);

          await writeFile(filePath, docContent, "utf-8");
          // Print a simple line for each file
          console.log(
            chalk.greenBright.bold("  ✔ ") +
            chalk.whiteBright("Generated: ") +
            chalk.cyanBright(fileName)
          );
        } catch (error) {
          console.log(
            chalk.redBright.bold("  ✖ ") +
            chalk.whiteBright("Failed to process: ") +
            chalk.yellowBright(file.fileName)
          );
          console.error(
            chalk.bgRed.white.bold(" ERROR "),
            chalk.redBright(error)
          );
        }
      }
    }
    generateSpinner.succeed(
      chalk.greenBright.bold("🎉 Documentation generated successfully!")
    );
  } catch (error) {
    generateSpinner.fail("Failed to generate documentation");
    throw error;
  }

  // Generate category index files
  const indexSpinner = ora({
    text: "Generating category indexes...",
    color: "green",
    spinner: "dots",
  }).start();
  await generateCategoryIndexes(nonEmptyGrouped, baseDir);
  indexSpinner.succeed("Category indexes generated");

  // Generate Astro config with Starlight sidebar
  const configSpinner = ora({
    text: "Generating Astro configuration...",
    color: "magenta",
    spinner: "dots",
  }).start();
  await generateAstroConfig(nonEmptyGrouped, config, tempDir);
  configSpinner.succeed("Astro configuration generated");

  // Generate custom index.mdx file
  const mainIndexSpinner = ora({
    text: "Generating main index file...",
    color: "blue",
    spinner: "dots",
  }).start();
  const indexContent = generateIndexMdx(nonEmptyGrouped, config);
  const indexPath = join(tempDir, "content", "docs", "index.mdx");
  await writeFile(indexPath, indexContent, "utf-8");
  mainIndexSpinner.succeed("Main index file generated");

  // Generate getting started page
  const gettingStartedSpinner = ora({
    text: "Generating getting started page...",
    color: "green",
    spinner: "dots",
  }).start();
  const gettingStartedContent = generateGettingStartedMdx(
    nonEmptyGrouped,
    config
  );
  const gettingStartedDir = join(tempDir, "content", "docs", "getting-started");
  await mkdir(gettingStartedDir, { recursive: true });
  const gettingStartedPath = join(gettingStartedDir, "index.md");
  await writeFile(gettingStartedPath, gettingStartedContent, "utf-8");
  gettingStartedSpinner.succeed("Getting started page generated");

  // Handle translations if enabled (before moving to final location)
  console.log(chalk.blue(`🔧 Translation config check:`));
  console.log(chalk.gray(`   useTranslation: ${config.useTranslation}`));
  console.log(
    chalk.gray(`   lingoApiKey: ${config.lingoApiKey ? "present" : "missing"}`)
  );
  console.log(
    chalk.gray(
      `   languages: ${config.languages ? config.languages.join(", ") : "none"}`
    )
  );

  if (
    config.useTranslation &&
    config.lingoApiKey &&
    config.languages &&
    config.languages.length > 0
  ) {
    console.log(
      chalk.green(`✅ Translation conditions met, starting translation...`)
    );
    await handleTranslations(tempDir, config);
  } else {
    console.log(chalk.yellow(`⚠️  Translation skipped - conditions not met`));
  }

  // Move generated content to Astro project
  const moveSpinner = ora({
    text: "Moving content to final location...",
    color: "cyan",
    spinner: "dots",
  }).start();
  await moveContentToAstroProject(tempDir, outputDir);
  moveSpinner.succeed("Content moved successfully");

  console.log(
    chalk.greenBright.bold("\n🎉 Documentation generated successfully!")
  );
  console.log(
    chalk.blueBright.bold("📁 Output directory: ") +
    chalk.whiteBright.bold(`${outputDir}`)
  );

  console.log(chalk.gray.bold(`\ncd ${outputDir}\nnpm run dev\n`));
}

async function generateFileDoc(
  file: FileInfo,
  category: string,
  config: any
): Promise<string> {
  const prompt = getCategoryPrompt(category, file, config);

  try {
    // Use Google Gemini to generate documentation
    const result = await generateText({
      model: google("gemini-2.0-flash"),
      prompt: prompt,
      maxTokens: 4000,
      temperature: 0.3,
    });

    // Add frontmatter to the AI-generated content
    return addFrontmatter(result.text, file, category, config);
  } catch (error) {
    // Fallback to structure generation
    const fallbackContent = generateDocStructure(
      file,
      category,
      prompt,
      config
    );
    return addFrontmatter(fallbackContent, file, category, config);
  }
}

/**
 * Handle translation of generated documentation
 */
async function handleTranslations(
  outputDir: string,
  config: any
): Promise<void> {
  const docsDir = join(outputDir, "content", "docs");

  console.log(chalk.blue(`🔧 Starting translation process...`));
  console.log(chalk.gray(`   Output directory: ${outputDir}`));
  console.log(chalk.gray(`   Docs directory: ${docsDir}`));

  // Create translator instance
  const translator = new DocumentationTranslator({
    apiKey: config.lingoApiKey,
    languages: config.languages,
    sourceLocale: "en", // Default source language
  });

  try {
    const { mkdir, readdir, stat } = await import("fs/promises");
    const { existsSync } = await import("fs");

    // Check if docs directory exists and has content
    if (!existsSync(docsDir)) {
      console.log(
        chalk.yellow("⚠️  Docs directory not found, skipping translation")
      );
      return;
    }

    const items = await readdir(docsDir);
    console.log(
      chalk.blue(`📁 Found items in docs directory: ${items.join(", ")}`)
    );

    // Filter out language directories and hidden files
    const contentItems = items.filter(
      (item) =>
        !item.startsWith(".") &&
        !config.languages.includes(item) &&
        item !== "en"
    );

    console.log(
      chalk.blue(`📁 Filtered content items: ${contentItems.join(", ")}`)
    );

    if (contentItems.length === 0) {
      console.log(chalk.yellow("⚠️  No content files found to translate"));
      return;
    }

    console.log(
      chalk.blue(`📁 Content items to translate: ${contentItems.join(", ")}`)
    );

    // Create language directories for translations
    for (const language of config.languages) {
      const langDir = join(docsDir, language);
      if (!existsSync(langDir)) {
        await mkdir(langDir, { recursive: true });
        console.log(chalk.green(`✅ Created language directory: ${language}`));
      } else {
        console.log(
          chalk.gray(`📁 Language directory already exists: ${language}`)
        );
      }
    }

    // Now translate from the main docs directory to language subdirectories
    console.log(chalk.blue(`🚀 Starting translation with Lingo.dev...`));
    await translator.translateDocumentation(docsDir, docsDir);

    console.log(chalk.green(`✅ Translations completed!`));
    console.log(
      chalk.blue(`📁 Translated docs available in: ${chalk.bold(docsDir)}`)
    );
  } catch (error) {
    console.error(chalk.red(`❌ Translation failed: ${error}`));
    if (error instanceof Error) {
      console.error(chalk.red(`❌ Error details: ${error.message}`));
    }
    // Don't throw error to avoid breaking the main generation process
  }
}
