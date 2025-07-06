import { LingoDotDevEngine } from "lingo.dev/sdk";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import chalk from "chalk";
import ora from "ora";

export interface TranslationConfig {
  apiKey: string;
  languages: string[];
  sourceLocale: string;
}

export class DocumentationTranslator {
  private lingo: LingoDotDevEngine;
  private config: TranslationConfig;

  constructor(config: TranslationConfig) {
    this.config = config;
    this.lingo = new LingoDotDevEngine({
      apiKey: config.apiKey,
      batchSize: 50,
      idealBatchItemSize: 1000,
    });
  }

  /**
   * Translate all documentation files to the specified languages
   */
  async translateDocumentation(
    sourceDir: string,
    targetDir: string
  ): Promise<void> {
    const translationSpinner = ora({
      text: "Initializing translation process...",
      color: "blue",
      spinner: "dots",
    }).start();

    try {
      // Test Lingo.dev connection
      await this.testConnection();
      translationSpinner.succeed("Translation service connected successfully");

      // Create target directory structure
      await this.createTargetStructure(targetDir);

      // Translate all files
      await this.translateAllFiles(sourceDir, targetDir);

      console.log(
        chalk.green(
          `✅ Documentation translated to ${this.config.languages.length} languages`
        )
      );
    } catch (error) {
      translationSpinner.fail("Translation failed");
      console.error(chalk.red(`❌ Translation error: ${error}`));
      throw error;
    }
  }

  /**
   * Test the Lingo.dev connection
   */
  private async testConnection(): Promise<void> {
    try {
      await this.lingo.localizeText("Hello world", {
        sourceLocale: "en",
        targetLocale: "es",
      });
    } catch (error) {
      throw new Error(`Failed to connect to Lingo.dev: ${error}`);
    }
  }

  /**
   * Create the target directory structure for translations
   */
  private async createTargetStructure(targetDir: string): Promise<void> {
    const structureSpinner = ora({
      text: "Creating translation directory structure...",
      color: "cyan",
      spinner: "dots",
    }).start();

    try {
      // Create main target directory
      await mkdir(targetDir, { recursive: true });

      // Create language subdirectories (no 'en' directory needed)
      for (const language of this.config.languages) {
        const langDir = join(targetDir, language);
        await mkdir(langDir, { recursive: true });
      }

      structureSpinner.succeed("Translation directory structure created");
    } catch (error) {
      structureSpinner.fail("Failed to create directory structure");
      throw error;
    }
  }

  /**
   * Recursively translate all files in the source directory
   */
  private async translateAllFiles(
    sourceDir: string,
    targetDir: string
  ): Promise<void> {
    const files = await this.getAllFiles(sourceDir);

    console.log(
      chalk.blue(`🔍 Found ${files.length} files to translate in ${sourceDir}`)
    );
    if (files.length > 0) {
      console.log(
        chalk.blue(
          `📄 Files: ${files.slice(0, 5).join(", ")}${files.length > 5 ? "..." : ""}`
        )
      );
    }

    if (files.length === 0) {
      console.log(chalk.yellow("⚠️  No files found to translate"));
      return;
    }

    const totalFiles = files.length * this.config.languages.length;

    console.log(
      chalk.blue(
        `📝 Translating ${files.length} files to ${this.config.languages.length} languages (${totalFiles} total translations)`
      )
    );

    let completedTranslations = 0;
    let failedTranslations = 0;

    for (const filePath of files) {
      const relativePath = filePath.replace(sourceDir, "").replace(/^\//, "");

      for (const language of this.config.languages) {
        try {
          await this.translateFile(filePath, targetDir, language, relativePath);
          completedTranslations++;

          // Show progress
          const progress = Math.round(
            (completedTranslations / totalFiles) * 100
          );
          process.stdout.write(
            `\r${chalk.cyan(`Progress: ${progress}% (${completedTranslations}/${totalFiles})`)}`
          );
        } catch (error) {
          failedTranslations++;
          console.error(
            chalk.red(
              `\n❌ Failed to translate ${relativePath} to ${language}: ${error}`
            )
          );
        }
      }
    }

    console.log(chalk.green(`\n✅ Translation completed!`));
    if (failedTranslations > 0) {
      console.log(
        chalk.yellow(`⚠️  ${failedTranslations} translations failed`)
      );
    }
  }

  /**
   * Get all files recursively from a directory, excluding language subdirectories
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    const { readdir, stat } = await import("fs/promises");
    const files: string[] = [];

    try {
      const items = await readdir(dir);

      for (const item of items) {
        const fullPath = join(dir, item);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          // Skip language directories and hidden directories
          if (
            !item.startsWith(".") &&
            !this.config.languages.includes(item) &&
            item !== "en"
          ) {
            files.push(...(await this.getAllFiles(fullPath)));
          }
        } else if (stats.isFile() && this.shouldTranslateFile(fullPath)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(
        chalk.yellow(`Warning: Could not read directory ${dir}: ${error}`)
      );
    }

    return files;
  }

  /**
   * Check if a file should be translated (MDX files only)
   */
  private shouldTranslateFile(filePath: string): boolean {
    return filePath.endsWith(".mdx") || filePath.endsWith(".md");
  }

  /**
   * Translate a single file
   */
  private async translateFile(
    sourcePath: string,
    targetDir: string,
    language: string,
    relativePath: string
  ): Promise<void> {
    const content = await readFile(sourcePath, "utf-8");
    const translatedContent = await this.translateContent(content, language);

    const targetPath = join(targetDir, language, relativePath);
    const targetDirPath = dirname(targetPath);

    // Ensure target directory exists
    if (!existsSync(targetDirPath)) {
      await mkdir(targetDirPath, { recursive: true });
    }

    await writeFile(targetPath, translatedContent, "utf-8");
  }

  /**
   * Translate the content of a file
   */
  private async translateContent(
    content: string,
    targetLanguage: string
  ): Promise<string> {
    // Parse frontmatter and content
    const { frontmatter, markdown } = this.parseFrontmatter(content);

    // Translate the markdown content
    const translatedMarkdown = await this.translateMarkdown(
      markdown,
      targetLanguage
    );

    // Update frontmatter with language info
    const updatedFrontmatter = this.updateFrontmatter(
      frontmatter,
      targetLanguage
    );

    // Reconstruct the file
    return this.reconstructFile(updatedFrontmatter, translatedMarkdown);
  }

  /**
   * Parse frontmatter from MDX content
   */
  private parseFrontmatter(content: string): {
    frontmatter: string;
    markdown: string;
  } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (match) {
      return {
        frontmatter: match[1],
        markdown: match[2],
      };
    }

    return {
      frontmatter: "",
      markdown: content,
    };
  }

  /**
   * Translate markdown content using Lingo.dev
   */
  private async translateMarkdown(
    markdown: string,
    targetLanguage: string
  ): Promise<string> {
    try {
      // Split content into chunks to handle large files
      const chunks = this.splitContentIntoChunks(markdown);
      const translatedChunks: string[] = [];

      for (const chunk of chunks) {
        if (chunk.trim()) {
          const translated = await this.lingo.localizeText(chunk, {
            sourceLocale: this.config.sourceLocale,
            targetLocale: targetLanguage,
          });
          translatedChunks.push(translated);
        } else {
          translatedChunks.push(chunk);
        }
      }

      return translatedChunks.join("\n\n");
    } catch (error) {
      console.error(
        chalk.yellow(
          `Warning: Translation failed for chunk, using original: ${error}`
        )
      );
      return markdown;
    }
  }

  /**
   * Split content into manageable chunks for translation
   */
  private splitContentIntoChunks(content: string): string[] {
    // Split by double newlines to preserve paragraph structure
    const paragraphs = content.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const paragraph of paragraphs) {
      if ((currentChunk + paragraph).length > 2000) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = paragraph;
        } else {
          // Single paragraph is too long, split by sentences
          const sentences = paragraph.split(/(?<=[.!?])\s+/);
          chunks.push(...sentences);
        }
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Update frontmatter with language information
   */
  private updateFrontmatter(
    frontmatter: string,
    targetLanguage: string
  ): string {
    // Add or update language information in frontmatter
    const langLine = `lang: ${targetLanguage}`;

    if (frontmatter.includes("lang:")) {
      // Replace existing lang line
      return frontmatter.replace(/lang:\s*\w+/g, langLine);
    } else {
      // Add lang line at the beginning
      return frontmatter ? `${langLine}\n${frontmatter}` : langLine;
    }
  }

  /**
   * Reconstruct file with frontmatter and content
   */
  private reconstructFile(frontmatter: string, markdown: string): string {
    if (frontmatter) {
      return `---\n${frontmatter}\n---\n\n${markdown}`;
    }
    return markdown;
  }
}
