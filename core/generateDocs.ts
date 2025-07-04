import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import type { FileInfo } from "./fileRead.ts";
import chalk from "chalk";

// Import from modular files
import { getCategoryPrompt } from "./prompts.ts";
import { addFrontmatter, generateDocStructure } from "./contentProcessing.ts";
import { groupFilesByCategory, getUniqueFileName } from "./fileUtils.ts";
import { generateIndexMdx } from "./indexGenerator.ts";
import {
  createAstroProject,
  generateAstroConfig,
  moveContentToAstroProject,
  generateCategoryIndexes,
} from "./astroGenerator.ts";

// Load config function
async function loadConfig() {
  try {
    // Look for config in the current working directory (project root)
    const configPath = join(process.cwd(), "zen.config.js");
    const config = (await import(configPath)).default;
    return config;
  } catch (error) {
    console.error(
      chalk.red("❌ Error: zen.config.js not found in project root!")
    );
    console.error(
      chalk.yellow("Please run 'zen-doc init' to create a configuration file.")
    );
    process.exit(1);
  }
}

export async function generateDocs(fileInfos: FileInfo[]): Promise<void> {
  const config = await loadConfig();
  const outputDir = `./${config.outputDir}`;
  const tempDir = `./temp-zen-docs-${Date.now()}`;
  const baseDir = `${tempDir}/content/docs`;

  // Set the API key from config as environment variable
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = config.apiKey;
  console.log(
    chalk.blue(
      `🔧 Loaded config for project: ${chalk.bold(config.projectName)}`
    )
  );

  // Create Astro project with Starlight template if it doesn't exist
  await createAstroProject(outputDir, config);

  // Test AI connection
  try {
    console.log(chalk.cyan("🧪 Testing AI connection..."));
    const testResult = await generateText({
      model: google("gemini-2.0-flash"),
      prompt: "Say 'Hello, AI is working!'",
      maxTokens: 50,
    });
    console.log(chalk.green(`✅ AI connection successful`));
  } catch (error) {
    console.error(chalk.red(`❌ AI test failed: ${error}`));
    console.error(chalk.yellow("Please check your API key in zen.config.js"));
    process.exit(1);
  }

  // Filter to only show the categories we care about
  const relevantCategories = ["components", "pages", "api", "lib"];
  const filteredFileInfos = fileInfos.filter((file) =>
    relevantCategories.includes(file.category)
  );

  // Group files by category
  const grouped = groupFilesByCategory(filteredFileInfos);

  // Generate documentation for each category
  for (const [category, files] of Object.entries(grouped)) {
    if (files.length === 0) continue;

    console.log(
      chalk.magenta(
        `\n📚 Generating ${chalk.bold(category.toUpperCase())} documentation`
      )
    );
    console.log(chalk.gray(`   Found ${files.length} files`));

    // Create category directory
    const categoryDir = join(baseDir, category);
    await mkdir(categoryDir, { recursive: true });

    // Generate docs for each file in the category
    for (const file of files) {
      console.log(chalk.cyan(`   🤖 Processing: ${chalk.bold(file.fileName)}`));
      const docContent = await generateFileDoc(file, category, config);
      const fileName = getUniqueFileName(file, category);
      const filePath = join(categoryDir, fileName);

      await writeFile(filePath, docContent, "utf-8");
      console.log(chalk.green(`   ✅ Generated: ${fileName}`));
    }
  }

  // Generate category index files
  await generateCategoryIndexes(grouped, baseDir);

  // Generate Astro config with Starlight sidebar
  await generateAstroConfig(grouped, config, tempDir);

  // Generate custom index.mdx file
  const indexContent = generateIndexMdx(grouped, config);
  const indexPath = join(tempDir, "content", "docs", "index.mdx");
  await writeFile(indexPath, indexContent, "utf-8");

  // Move generated content to Astro project
  await moveContentToAstroProject(tempDir, outputDir);

  console.log(chalk.green(`\n🎉 Documentation generated successfully!`));
  console.log(
    chalk.blue(`📁 Output directory: ${chalk.bold(outputDir)}/content/docs`)
  );
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

    console.log(chalk.gray(`     Generated ${result.text.length} characters`));

    // Add frontmatter to the AI-generated content
    return addFrontmatter(result.text, file, category, config);
  } catch (error) {
    console.warn(
      chalk.yellow(`     ⚠️  AI generation failed, using fallback structure`)
    );
    console.warn(chalk.gray(`     Error: ${error}`));

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
