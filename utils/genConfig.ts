import prompts from "prompts";
import { writeFileSync } from "fs";

export const generateConfig = async () => {
  const response = await prompts([
    {
      type: "text",
      name: "apiKey",
      message: "Enter your Google Gemini API Key:",
    },
    { type: "text", name: "projectName", message: "Project Name:" },
    { type: "text", name: "author", message: "Author Name:" },
    {
      type: "list",
      name: "include",
      message: "Folders to include (comma separated):",
      separator: ",",
    },
    {
      type: "text",
      name: "outputDir",
      message: "Output directory for docs:",
      initial: "docs",
    },
    {
      type: "toggle",
      name: "useTranslation",
      message: "Enable automatic translation with Lingo.dev?",
      initial: false,
      active: "yes",
      inactive: "no",
    },
    {
      type: (prev) => (prev ? "list" : null),
      name: "languages",
      message: "Which languages to support? (comma separated)",
      separator: ",",
    },
  ]);

  const config = `export default ${JSON.stringify(response, null, 2)};\n`;
  writeFileSync("zen.config.js", config);
  console.log("✅ zen.config.js created successfully!");
};
