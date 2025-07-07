import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import ora from "ora";
import chalk from "chalk";
import figlet from "figlet";

import {
  readCodebase,
  categorizeFiles,
  generateDocs,
  generateConfig,
} from "./core/index.js";
import { checkValidNodeProject } from "./core/fileUtils.js";

// Hard-coded version
const version = "1.0.30";

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
