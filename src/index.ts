import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import ora from "ora";

import {
  readCodebase,
  categorizeFiles,
  generateDocs,
  generateConfig,
} from "./core/index.js";
import { checkValidNodeProject } from "./core/fileUtils.js";

// Hard-coded version
const version = "1.0.26";

const argv = typeof Bun !== "undefined" ? Bun.argv : process.argv;

yargs(hideBin(argv))
  .version(version)
  .alias("v", "version")
  .command("init", "Generate zen.config.mjs", {}, async () => {
    checkValidNodeProject();
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

        console.log(`\n📁 File categories:`);
        Object.entries(categoryCounts).forEach(([category, count]) => {
          console.log(`  - ${category}: ${count} files`);
        });

        // Step 3: Generate documentation
        const generateSpinner = ora("Generating documentation...").start();
        await generateDocs(fileInfos);
        generateSpinner.succeed("Documentation generated successfully!");
      } catch (error) {
        spinner.fail("Error processing files");
        console.error(error);
        process.exit(1);
      }
    }
  )
  .demandCommand()
  .help()
  .parse();
