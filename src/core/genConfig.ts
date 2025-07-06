import prompts from "prompts";
import { writeFileSync } from "fs";

export const generateConfig = async () => {
  // First, get the basic config without translation questions
  const basicResponse = await prompts([
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
  ]);

  let response: any = { ...basicResponse };

  // If translation is enabled, ask for additional translation questions
  if (basicResponse.useTranslation) {
    const translationResponse = await prompts([
      {
        type: "text",
        name: "lingoApiKey",
        message: "Enter your Lingo.dev API Key:",
      },
      {
        type: "list",
        name: "languages",
        message:
          "Which languages to support? (comma separated, e.g., es,fr,de)",
        separator: ",",
      },
    ]);
    response = { ...response, ...translationResponse };
  } else {
    // Set empty values for translation fields if translation is disabled
    response.lingoApiKey = "";
    response.languages = [];
  }

  const config = `export default ${JSON.stringify(response, null, 2)};\n`;
  writeFileSync("zen.config.mjs", config);
  console.log("✅ zen.config.mjs created successfully!");
};
