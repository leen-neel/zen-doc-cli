import prompts from "prompts";
import { writeFileSync } from "fs";

export const generateConfig = async () => {
  // First, get the basic config without translation questions
  const basicResponse = await prompts([
    {
      type: "text",
      name: "projectName",
      message: "Project Name:",
    },
    { type: "text", name: "author", message: "Author Name:" },
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
    response.languages = [];
  }

  // Create config with environment variable references for API keys
  const config = `export default {
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  projectName: ${JSON.stringify(response.projectName)},
  author: ${JSON.stringify(response.author)},
  include: ${JSON.stringify(response.include)},
  outputDir: ${JSON.stringify(response.outputDir)},
  useTranslation: ${JSON.stringify(response.useTranslation)},
  lingoApiKey: process.env.LINGO_API_KEY,
  languages: ${JSON.stringify(response.languages)},
};\n`;

  writeFileSync("zen.config.mjs", config);
  console.log("✅ zen.config.mjs created successfully!");
  console.log("📝 API keys will be read from environment variables:");
  console.log("   - GOOGLE_GENERATIVE_AI_API_KEY for Google Gemini");
  console.log("   - LINGO_API_KEY for Lingo.dev (if translation enabled)");
};
