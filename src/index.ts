import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import ora from "ora";
import chalk from "chalk";
import figlet from "figlet";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

import {
  readCodebase,
  categorizeFiles,
  generateDocs,
  generateConfig,
} from "./core/index.js";
import { checkValidNodeProject } from "./core/fileUtils.js";

// Hard-coded version
const version = "1.0.33";

/**
 * Parse .env file content into key-value pairs
 */
function parseEnvFile(content: string): Record<string, string> {
  const envVars: Record<string, string> = {};

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    // Parse KEY=value format
    const equalIndex = trimmedLine.indexOf("=");
    if (equalIndex > 0) {
      const key = trimmedLine.substring(0, equalIndex).trim();
      const value = trimmedLine.substring(equalIndex + 1).trim();

      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, "");

      if (key && cleanValue !== undefined) {
        envVars[key] = cleanValue;
      }
    }
  }

  return envVars;
}

/**
 * Load environment variables from .env file
 */
function loadEnvFile(): void {
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, "utf-8");
      const envVars = parseEnvFile(envContent);

      // Load variables into process.env
      Object.entries(envVars).forEach(([key, value]) => {
        if (!process.env[key]) {
          process.env[key] = value;
        }
      });
    } catch (error) {
      console.log("⚠️  Could not load .env file");
    }
  }
}

// Load environment variables at startup
loadEnvFile();

const argv = typeof Bun !== "undefined" ? Bun.argv : process.argv;

yargs(hideBin(argv))
  .version(version)
  .alias("v", "version")
  .command("init", "Generate zen.config.mjs", {}, async () => {
    checkValidNodeProject();

    // Display beautiful figlet header
    console.log(chalk.cyanBright.bold("\n"));

    // Create a promise to handle figlet text display
    await new Promise<void>((resolve) => {
      figlet.text(
        "Zen Doc",
        {
          font: "Standard",
          horizontalLayout: "default",
          verticalLayout: "default",
          width: 80,
          whitespaceBreak: true,
        },
        (err, data) => {
          if (err) {
            console.log("Something went wrong...");
            console.dir(err);
            resolve();
            return;
          }
          console.log(chalk.cyanBright.bold(data));
          console.log(
            chalk.gray.bold(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            )
          );
          console.log(chalk.blueBright.bold("⚙️  Let's get you started..."));
          console.log(
            chalk.gray.bold(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            )
          );
          resolve();
        }
      );
    });

    await generateConfig();
  })
  .command(
    "generate",
    "Generate documentation",
    (yargs) => {
      return yargs;
    },
    async (argv) => {
      checkValidNodeProject();

      // Display beautiful figlet header
      console.log(chalk.cyanBright.bold("\n"));

      // Create a promise to handle figlet text display
      await new Promise<void>((resolve) => {
        figlet.text(
          "Zen Doc",
          {
            font: "Standard",
            horizontalLayout: "default",
            verticalLayout: "default",
            width: 80,
            whitespaceBreak: true,
          },
          (err, data) => {
            if (err) {
              console.log("Something went wrong...");
              console.dir(err);
              resolve();
              return;
            }
            console.log(chalk.cyanBright.bold(data));
            console.log(
              chalk.gray.bold(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
              )
            );
            console.log(
              chalk.blueBright.bold(
                "🚀 Generating beautiful documentation for your project..."
              )
            );
            console.log(
              chalk.gray.bold(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
              )
            );
            resolve();
          }
        );
      });

      const spinner = ora("Reading codebase from current directory...").start();

      try {
        // Step 1: Read all files
        const files = await readCodebase();
        spinner.succeed(`Found ${files.length} files`);

        // Step 2: Categorize files
        const categorizeSpinner = ora("Categorizing files...").start();
        const fileInfos = await categorizeFiles(files);
        categorizeSpinner.succeed("Files categorized successfully");

        // Show categorization summary
        const categoryCounts = fileInfos.reduce(
          (acc, file) => {
            acc[file.category] = (acc[file.category] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        // Filter out empty categories
        const nonEmptyCategories = Object.entries(categoryCounts).filter(
          ([_, count]) => count > 0
        );

        console.log();
        console.log(chalk.bold.bgBlueBright.white(" ZenDoc File Categories "));
        nonEmptyCategories.forEach(([category, count]) => {
          const icon = count > 0 ? "📁" : "📄";
          console.log(
            chalk.blueBright(`  ${icon} `) +
              chalk.bold(`${category.padEnd(12)}`) +
              chalk.whiteBright(": ") +
              chalk.greenBright.bold(`${count} files`)
          );
        });
        console.log();

        // Step 3: Generate documentation
        const generateSpinner = ora("Generating documentation...").start();
        await generateDocs(fileInfos);
        generateSpinner.succeed("Documentation generated successfully!");
      } catch (error) {
        spinner.fail(chalk.redBright.bold("✖ Error processing files"));
        console.error(
          chalk.bgRed.white.bold(" ERROR "),
          chalk.redBright(error)
        );
        process.exit(1);
      }
    }
  )
  .demandCommand()
  .help()
  .parse();
