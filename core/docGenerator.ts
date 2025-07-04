import type { FileInfo } from "./fileRead.js";

export async function generateDocumentation(
  fileInfos: FileInfo[],
  outputDir: string = "./docs"
): Promise<void> {
  // Filter to only show the categories we care about
  const relevantCategories = ["components", "pages", "api", "lib"];
  const filteredFileInfos = fileInfos.filter((file) =>
    relevantCategories.includes(file.category)
  );

  // Group files by category
  const grouped = groupFilesByCategory(filteredFileInfos);

  // Print documentation for each category
  for (const [category, files] of Object.entries(grouped)) {
    if (files.length === 0) continue;

    console.log(`\n=== ${category.toUpperCase()} ===`);
    console.log(`Files: ${files.length}\n`);

    // Print each file
    for (const file of files) {
      console.log(`📁 ${file.relativePath}`);
      console.log(`Content:\n${file.content}\n`);
      console.log("─".repeat(50));
    }
  }
}

function groupFilesByCategory(
  fileInfos: FileInfo[]
): Record<string, FileInfo[]> {
  const grouped: Record<string, FileInfo[]> = {};

  for (const fileInfo of fileInfos) {
    if (!grouped[fileInfo.category]) {
      grouped[fileInfo.category] = [];
    }
    grouped[fileInfo.category].push(fileInfo);
  }

  return grouped;
}
