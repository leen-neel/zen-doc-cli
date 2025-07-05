import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

import {
  readCodebase,
  categorizeFiles,
  generateDocs,
  generateConfig,
} from "./core";

const argv = typeof Bun !== "undefined" ? Bun.argv : process.argv;

yargs(hideBin(argv))
  .command("init", "Generate zen.config.js", {}, async () => {
    await generateConfig();
  })
  .command(
    "generate",
    "Generate documentation",
    (yargs) => {
      return yargs;
    },
    async (argv) => {
      console.log(`Reading codebase from current directory...`);

      try {
        // Step 1: Read all files
        const files = await readCodebase();
        console.log(`Found ${files.length} files`);

        // Step 2: Categorize files
        console.log(`\nCategorizing files...`);
        const fileInfos = await categorizeFiles(files);

        // Show categorization summary
        const categoryCounts = fileInfos.reduce((acc, file) => {
          acc[file.category] = (acc[file.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        console.log(`\nFile categories:`);
        Object.entries(categoryCounts).forEach(([category, count]) => {
          console.log(`  - ${category}: ${count} files`);
        });

        // Step 3: Generate documentation
        console.log(`\nGenerating documentation...`);
        await generateDocs(fileInfos);
      } catch (error) {
        console.error("Error processing files:", error);
        process.exit(1);
      }
    }
  )
  .demandCommand()
  .help()
  .parse();
