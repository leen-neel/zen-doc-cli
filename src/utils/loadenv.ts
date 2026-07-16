import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { REQUIRED_KEYS } from "./consts.js";

export function loadEnvFile(): {
  googleApiKey: string | undefined;
  lingoApiKey: string | undefined;
} {
  const envPath = join(process.cwd(), ".env");

  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf-8");

      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const [key, ...rest] = trimmed.split("=");
        const value = rest.join("=").trim().replace(/^["']|["']$/g, "");

        if (REQUIRED_KEYS.includes(key) && !process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      console.log("⚠️  Could not load .env file");
    }
  }

  // Prefer GENERATIVE_AI_API_KEY when both exist — older GOOGLE_* keys
  // are often stale while AI Studio issues AQ.* keys under the alias.
  const googleApiKey =
    process.env.GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  // AI SDK reads GOOGLE_GENERATIVE_AI_API_KEY; keep it in sync with the chosen key.
  if (googleApiKey) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = googleApiKey;
  }

  return {
    googleApiKey,
    lingoApiKey: process.env.LINGO_API_KEY,
  };
}
