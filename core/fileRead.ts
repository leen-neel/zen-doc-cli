import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export interface FileInfo {
  path: string;
  content: string;
  category: "components" | "pages" | "api" | "lib" | "config" | "other";
  relativePath: string;
  fileName: string;
  extension: string;
}

export async function readCodebase(
  ignoredFolders: string[] = ["node_modules", "dist", ".next", ".git"]
): Promise<string[]> {
  const files: string[] = [];

  // Read .gitignore if it exists
  let gitignorePatterns: string[] = [];
  const gitignorePath = join(process.cwd(), ".gitignore");

  if (existsSync(gitignorePath)) {
    try {
      const gitignoreContent = await readFile(gitignorePath, "utf-8");
      gitignorePatterns = gitignoreContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#")) // Remove empty lines and comments
        .map((pattern) => {
          // Remove leading slash and trailing slash
          return pattern.replace(/^\/+/, "").replace(/\/+$/, "");
        });
    } catch (error) {
      console.warn("Warning: Could not read .gitignore file:", error);
    }
  }

  // Combine gitignore patterns with default ignored folders
  const allIgnoredPatterns = [
    ...new Set([...gitignorePatterns, ...ignoredFolders]),
  ];

  function shouldIgnore(path: string): boolean {
    const relativePath = path.replace(process.cwd(), "").replace(/^\/+/, "");

    return allIgnoredPatterns.some((pattern) => {
      // Handle directory patterns (ending with /)
      if (pattern.endsWith("/")) {
        const dirPattern = pattern.slice(0, -1);
        return (
          relativePath.startsWith(dirPattern + "/") ||
          relativePath === dirPattern
        );
      }

      // Handle file patterns
      return relativePath === pattern || relativePath.endsWith("/" + pattern);
    });
  }

  async function traverse(currentDir: string): Promise<void> {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        const relativePath = fullPath
          .replace(process.cwd(), "")
          .replace(/^\/+/, "");

        if (entry.isDirectory()) {
          // Skip ignored folders
          if (!shouldIgnore(relativePath)) {
            await traverse(fullPath);
          }
        } else {
          // Skip ignored files
          if (!shouldIgnore(relativePath)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentDir}:`, error);
    }
  }

  // Always start from current working directory
  await traverse(process.cwd());
  return files;
}

export async function categorizeFiles(files: string[]): Promise<FileInfo[]> {
  const fileInfos: FileInfo[] = [];

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relativePath = filePath
        .replace(process.cwd(), "")
        .replace(/^\/+/, "");
      const fileName = relativePath.split("/").pop() || "";
      const extension = fileName.split(".").pop()?.toLowerCase() || "";

      // Determine category based on path and content
      const category = determineCategory(relativePath, content, extension);

      fileInfos.push({
        path: filePath,
        content,
        category,
        relativePath,
        fileName,
        extension,
      });
    } catch (error) {
      console.warn(`Could not read file ${filePath}:`, error);
    }
  }

  return fileInfos;
}

function determineCategory(
  relativePath: string,
  content: string,
  extension: string
): FileInfo["category"] {
  const path = relativePath.toLowerCase();
  const fileName = relativePath.split("/").pop() || "";

  // Components - any file in components folder or subfolders
  if (
    path.includes("/components/") ||
    path.includes("/component/") ||
    path.startsWith("components/")
  ) {
    return "components";
  }

  // Pages - any file in pages folder or subfolders
  if (
    path.includes("/pages/") ||
    path.includes("/app/") ||
    path.startsWith("pages/")
  ) {
    return "pages";
  }

  // API routes - any file in api folder or subfolders
  if (
    path.includes("/api/") ||
    path.includes("/routes/") ||
    path.startsWith("api/")
  ) {
    return "api";
  }

  // Lib/Utils - any file in lib, utils, or helpers folders
  if (
    path.includes("/lib/") ||
    path.includes("/utils/") ||
    path.includes("/helpers/") ||
    path.startsWith("lib/") ||
    path.startsWith("utils/") ||
    path.startsWith("helpers/")
  ) {
    return "lib";
  }

  // Config files
  if (
    ["json", "yaml", "yml", "toml", "config.js", "config.ts"].includes(
      extension
    ) ||
    fileName.includes("config") ||
    fileName.includes("package") ||
    fileName.includes("tsconfig")
  ) {
    return "config";
  }

  return "other";
}

export function groupFilesByCategory(
  fileInfos: FileInfo[]
): Record<FileInfo["category"], FileInfo[]> {
  const grouped: Record<FileInfo["category"], FileInfo[]> = {
    components: [],
    pages: [],
    api: [],
    lib: [],
    config: [],
    other: [],
  };

  for (const fileInfo of fileInfos) {
    grouped[fileInfo.category].push(fileInfo);
  }

  return grouped;
}
