#!/usr/bin/env node

// Simple wrapper to run TypeScript files
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to use tsx if available, otherwise fall back to ts-node
const tsxPath = path.join(__dirname, "node_modules", ".bin", "tsx");
const tsNodePath = path.join(__dirname, "node_modules", ".bin", "ts-node");

let runner = "tsx";
let runnerPath = tsxPath;

// Check if tsx is available
if (!fs.existsSync(tsxPath)) {
  // Try ts-node
  if (fs.existsSync(tsNodePath)) {
    runner = "ts-node";
    runnerPath = tsNodePath;
  } else {
    console.error("Error: Neither tsx nor ts-node is available.");
    console.error("Please install one of them:");
    console.error("  npm install -g tsx");
    console.error("  npm install -g ts-node");
    process.exit(1);
  }
}

// Run the TypeScript file with all arguments
const child = spawn(
  runner,
  [path.join(__dirname, "index.ts"), ...process.argv.slice(2)],
  {
    stdio: "inherit",
    cwd: process.cwd(),
  }
);

child.on("close", (code) => {
  process.exit(code);
});
