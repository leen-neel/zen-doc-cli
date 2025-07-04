#!/usr/bin/env tsx

import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

import { writeFileSync } from "fs";
import prompts from "prompts";

import { readCodebase, categorizeFiles } from "./utils/fileRead.js";
import { generateDocumentation } from "./utils/docGenerator.js";

const generateConfig = async () => {
  const response = await prompts([
    { type: 'text', name: 'apiKey', message: 'Enter your Google Gemini API Key:' },
    { type: 'text', name: 'projectName', message: 'Project Name:' },
    { type: 'text', name: 'author', message: 'Author Name:' },
    { type: 'list', name: 'include', message: 'Folders to include (comma separated):', separator: ',' },
    { type: 'text', name: 'outputDir', message: 'Output directory for docs:', initial: 'docs' },
    { type: 'toggle', name: 'useTranslation', message: 'Enable automatic translation with Lingo.dev?', initial: false, active: 'yes', inactive: 'no' },
    { type: prev => prev ? 'list' : null, name: 'languages', message: 'Which languages to support? (comma separated)', separator: ',' }
  ]);

  const config = `export default ${JSON.stringify(response, null, 2)};\n`;
  writeFileSync("zen.config.js", config);
  console.log("✅ zen.config.js created successfully!");
};



// Use Bun.argv if available (Bun), otherwise use process.argv (Node.js)
const argv = typeof Bun !== "undefined" ? Bun.argv : process.argv;

yargs(hideBin(argv))
  .command("init", "Generate zen.config.js", {}, async () => {
    await generateConfig();
  .command("greet <name>", "Greet a user", {}, (argv) => {
    console.log(`Hello, ${argv.name}!`);
  })
  .command(
    "generate",
    "Generate documentation",
    (yargs) => {
      return yargs
        .option("output", {
          alias: "o",
          type: "string",
          description: "Output directory for generated documentation",
          default: "./docs",
        })
        .option("format", {
          alias: "f",
          type: "string",
          choices: ["markdown", "html", "json"],
          description: "Output format for documentation",
          default: "markdown",
        });
    },
    async (argv) => {
      console.log(`Reading codebase from current directory...`);
      console.log(`Output format: ${argv.format}`);
      console.log(`Output directory: ${argv.output}`);

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

        // Step 3: Print file contents
        console.log(`\nPrinting file contents...`);
        await generateDocumentation(fileInfos, argv.output);

        console.log(`\n✅ File contents printed successfully!`);
      } catch (error) {
        console.error("Error processing files:", error);
        process.exit(1);
      }
    }
  )
  .demandCommand()
  .help()
  .parse();
