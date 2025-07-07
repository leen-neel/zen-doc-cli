import { join } from "path";
import { existsSync } from "fs";
import { pathToFileURL } from "url";
import chalk from "chalk";
import ora from "ora";

/**
 * Load the Zen configuration file (zen.config.mjs) from the root directory.
 * Compatible across Windows, Linux, and macOS.
 */
export async function loadConfig() {
  const configPath = join(process.cwd(), "zen.config.mjs");
  const configSpinner = ora(`Looking for zen.config.mjs at ${configPath}`).start();

  if (!existsSync(configPath)) {
    configSpinner.fail("Configuration file not found.");
    console.error(chalk.red("❌ Error: zen.config.mjs not found in the project root."));
    console.error(chalk.yellow("Please run 'zen-doc@latest init' to create a configuration file."));
    process.exit(1);
  }

  try {
    const fileUrl = pathToFileURL(configPath).href;
    const config = (await import(fileUrl)).default;

    if (!config) {
      throw new Error("Config file exists but has no default export");
    }

    configSpinner.succeed(`Config loaded from: ${configPath}`);
    return config;
  } catch (error) {
    configSpinner.fail("Failed to load configuration.");
    console.error(chalk.red(`❌ Error loading zen.config.mjs: ${error}`));
    console.error(chalk.yellow("Ensure the config file has a valid default export."));
    console.error(chalk.gray("Example config structure:"));
    console.error(
      chalk.gray(`
        export default {
          projectName: "Your Project",
          outputDir: "docs",
          apiKey: "your-api-key",
          author: "Your Name"
        };
      `)
    );
    process.exit(1);
  }
}
