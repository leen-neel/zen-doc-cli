import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import type { FileInfo } from "./fileRead.js";

// Load config function
async function loadConfig() {
  try {
    // Look for config in the current working directory (project root)
    const configPath = join(process.cwd(), "zen.config.js");
    const config = (await import(configPath)).default;
    return config;
  } catch (error) {
    console.error("❌ Error: zen.config.js not found in project root!");
    console.error("Please run 'zen-doc init' to create a configuration file.");
    process.exit(1);
  }
}

export async function generateDocs(fileInfos: FileInfo[]): Promise<void> {
  const config = await loadConfig();
  const outputDir = `./${config.outputDir}`;
  const tempDir = `./temp-zen-docs-${Date.now()}`;
  const baseDir = `${tempDir}/content/docs`;

  // Set the API key from config as environment variable
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = config.apiKey;
  console.log(
    `🔧 Loaded config - Project: ${
      config.projectName
    }, API Key: ${config.apiKey.substring(0, 10)}...`
  );

  // Create Astro project with Starlight template if it doesn't exist
  await createAstroProject(outputDir, config);

  // Test AI connection
  try {
    console.log("🧪 Testing AI connection...");
    const testResult = await generateText({
      model: google("gemini-2.0-flash"),
      prompt: "Say 'Hello, AI is working!'",
      maxTokens: 50,
    });
    console.log(`✅ AI test successful: ${testResult.text}`);
  } catch (error) {
    console.error(`❌ AI test failed: ${error}`);
    console.error("Please check your API key in zen.config.js");
    process.exit(1);
  }

  // Filter to only show the categories we care about
  const relevantCategories = ["components", "pages", "api", "lib"];
  const filteredFileInfos = fileInfos.filter((file) =>
    relevantCategories.includes(file.category)
  );

  // Group files by category
  const grouped = groupFilesByCategory(filteredFileInfos);

  // Generate documentation for each category
  for (const [category, files] of Object.entries(grouped)) {
    if (files.length === 0) continue;

    console.log(`\n=== Generating ${category.toUpperCase()} documentation ===`);
    console.log(`Files: ${files.length}`);

    // Create category directory
    const categoryDir = join(baseDir, category);
    await mkdir(categoryDir, { recursive: true });

    // Generate docs for each file in the category
    for (const file of files) {
      console.log(`🤖 Generating AI documentation for: ${file.fileName}`);
      const docContent = await generateFileDoc(file, category, config);
      const fileName = getUniqueFileName(file, category);
      const filePath = join(categoryDir, fileName);

      await writeFile(filePath, docContent, "utf-8");
      console.log(`✅ Generated: ${filePath}`);
    }
  }

  // Generate category index files
  await generateCategoryIndexes(grouped, baseDir);

  // Generate Astro config with Starlight sidebar
  await generateAstroConfig(grouped, config, tempDir);

  // Move generated content to Astro project
  await moveContentToAstroProject(tempDir, outputDir);

  console.log(`\n✅ Documentation generated in: ${outputDir}/content/docs`);
}

async function generateFileDoc(
  file: FileInfo,
  category: string,
  config: any
): Promise<string> {
  const prompt = getCategoryPrompt(category, file, config);

  try {
    console.log(`🔑 Using API key: ${config.apiKey.substring(0, 10)}...`);

    // Use Google Gemini to generate documentation
    const result = await generateText({
      model: google("gemini-2.0-flash"),
      prompt: prompt,
      maxTokens: 4000,
      temperature: 0.3,
    });

    console.log(
      `✅ AI generated ${result.text.length} characters for ${file.fileName}`
    );

    // Add frontmatter to the AI-generated content
    return addFrontmatter(result.text, file, category, config);
  } catch (error) {
    console.warn(
      `⚠️  Failed to generate AI documentation for ${file.fileName}. Using fallback structure.`
    );
    console.warn(`Error: ${error}`);

    // Fallback to structure generation
    const fallbackContent = generateDocStructure(
      file,
      category,
      prompt,
      config
    );
    return addFrontmatter(fallbackContent, file, category, config);
  }
}

function getCategoryPrompt(
  category: string,
  file: FileInfo,
  config: any
): string {
  const basePrompt = `You are an expert documentation generator for the ${
    config.projectName
  } project. Analyze this ${category} file and create comprehensive, professional documentation.

PROJECT: ${config.projectName}
AUTHOR: ${config.author}
FILE: ${file.relativePath}
CONTENT:
\`\`\`${getLanguageFromExtension(file.extension)}
${file.content}
\`\`\`

Create detailed, well-structured documentation that follows best practices. Focus on clarity, completeness, and practical usage examples.

REQUIREMENTS:`;

  switch (category) {
    case "components":
      return `${basePrompt}
1. **Component Overview**: Explain what this component does and its purpose
2. **Props Interface**: Document all props with types, descriptions, and default values
3. **Usage Examples**: Provide 2-3 practical usage examples with different prop combinations
4. **Styling**: Document any styling props, CSS classes, or theme integration
5. **Accessibility**: Note any accessibility features (ARIA labels, keyboard navigation, etc.)
6. **Dependencies**: List any external dependencies or imports
7. **Best Practices**: Suggest usage patterns and common pitfalls to avoid

OUTPUT FORMAT:
- Use clear markdown with proper headings
- Include code blocks with syntax highlighting
- Add TypeScript interfaces for props
- Include a "Props" table
- Add "Examples" section with practical code snippets`;

    case "pages":
      return `${basePrompt}
1. **Page Purpose**: Explain what this page does and when users see it
2. **Routing**: Document the route path and any dynamic segments
3. **Data Fetching**: Explain any data fetching, API calls, or state management
4. **User Interactions**: Document forms, buttons, and user actions
5. **SEO**: Note any meta tags, titles, or SEO considerations
6. **Layout**: Describe the page layout and any layout components used
7. **Error Handling**: Document error states and loading states
8. **Dependencies**: List components, hooks, and utilities used

OUTPUT FORMAT:
- Use clear markdown with proper headings
- Include route information
- Document data flow and state management
- Add usage examples and edge cases
- Include error handling scenarios`;

    case "api":
      return `${basePrompt}
1. **Endpoint Overview**: Explain what this API endpoint does
2. **HTTP Method**: Document the HTTP method (GET, POST, PUT, DELETE, etc.)
3. **Request Format**: Document request body, query parameters, and headers
4. **Response Format**: Document response structure, status codes, and data types
5. **Authentication**: Note any authentication requirements
6. **Validation**: Document input validation rules and error responses
7. **Rate Limiting**: Note any rate limiting or throttling
8. **Error Handling**: Document all possible error responses and status codes
9. **Examples**: Provide request/response examples

OUTPUT FORMAT:
- Use clear markdown with proper headings
- Include OpenAPI-style documentation
- Add request/response examples with curl commands
- Document all status codes and error scenarios
- Include authentication and authorization details`;

    case "lib":
      return `${basePrompt}
1. **Function Purpose**: Explain what this utility/function does
2. **Parameters**: Document all parameters with types and descriptions
3. **Return Value**: Document the return type and what it contains
4. **Usage Examples**: Provide 3-4 practical usage examples
5. **Edge Cases**: Document how the function handles edge cases and errors
6. **Performance**: Note any performance considerations or limitations
7. **Dependencies**: List any internal or external dependencies
8. **Testing**: Suggest test cases and scenarios

OUTPUT FORMAT:
- Use clear markdown with proper headings
- Include TypeScript function signatures
- Add comprehensive usage examples
- Document error handling and edge cases
- Include performance notes and best practices`;

    default:
      return basePrompt;
  }
}

function generateDocStructure(
  file: FileInfo,
  category: string,
  prompt: string,
  config: any
): string {
  const title = file.fileName.replace(/\.[^/.]+$/, "");
  const language = getLanguageFromExtension(file.extension);

  let content = `# ${title}\n\n`;
  content += `**File:** \`${file.relativePath}\`\n`;
  content += `**Category:** ${category}\n`;
  content += `**Language:** ${language}\n\n`;

  // Add file description based on content
  content += generateFileDescription(file);

  // Add code block with syntax highlighting
  content += `## Source Code\n\n`;
  content += `\`\`\`${language}\n${file.content}\n\`\`\`\n\n`;

  // Add placeholder sections based on category
  content += getCategorySections(category);

  return content;
}

function generateFileDescription(file: FileInfo): string {
  // Try to extract JSDoc comments
  const jsDocMatch = file.content.match(/\/\*\*[\s\S]*?\*\//);
  if (jsDocMatch) {
    return `## Description\n\n${jsDocMatch[0]
      .replace(/\/\*\*|\*\//g, "")
      .trim()}\n\n`;
  }

  // Try to extract single-line comments
  const commentMatch = file.content.match(/\/\/\s*(.+)/);
  if (commentMatch) {
    return `## Description\n\n${commentMatch[1]}\n\n`;
  }

  return `## Description\n\n*Documentation will be generated here*\n\n`;
}

function getCategorySections(category: string): string {
  const sections = {
    components: `
## Props

*Props documentation will be generated here*

## Examples

*Usage examples will be generated here*

## Accessibility

*Accessibility features will be documented here*

## Dependencies

*Dependencies will be listed here*
`,
    pages: `
## Route Information

*Route details will be documented here*

## Data Flow

*Data fetching and state management will be documented here*

## User Interactions

*User interactions will be documented here*

## SEO

*SEO considerations will be documented here*
`,
    api: `
## Endpoint Information

*Endpoint details will be documented here*

## Request Format

*Request parameters and body will be documented here*

## Response Format

*Response structure will be documented here*

## Examples

*Request/response examples will be generated here*

## Error Handling

*Error scenarios will be documented here*
`,
    lib: `
## Function Signature

*Function signature will be documented here*

## Parameters

*Parameters will be documented here*

## Return Value

*Return value will be documented here*

## Examples

*Usage examples will be generated here*

## Edge Cases

*Edge cases and error handling will be documented here*
`,
  };

  return sections[category as keyof typeof sections] || "";
}

function getLanguageFromExtension(extension: string): string {
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    txt: "text",
  };

  return languageMap[extension] || "text";
}

async function generateCategoryIndexes(
  grouped: Record<string, FileInfo[]>,
  baseDir: string
): Promise<void> {
  for (const [category, files] of Object.entries(grouped)) {
    if (files.length === 0) continue;

    const categoryDir = join(baseDir, category);
    const indexPath = join(categoryDir, "index.md");

    // Generate frontmatter
    const frontmatter = `---
title: ${getCategoryTitle(category)}
description: ${getCategoryDescription(category)}
---

`;

    let content = frontmatter;
    content += `# ${getCategoryTitle(category)}\n\n`;
    content += `${getCategoryDescription(category)}\n\n`;
    content += `## Files\n\n`;

    for (const file of files) {
      const fileName = getUniqueFileName(file, category);
      const title = file.fileName.replace(/\.[^/.]+$/, "");
      const fileDescription = getFileDescription(file, category);

      // Create a more descriptive link with file info
      if (category === "api") {
        const routePath = getRouteFromPath(file.relativePath);
        const httpMethod = getHttpMethodFromFile(file);
        const method = httpMethod ? httpMethod.toUpperCase() : "API";
        content += `- [${method} ${
          routePath || title
        }](${fileName}) - ${fileDescription}\n`;
      } else {
        content += `- [${title}](${fileName}) - ${fileDescription}\n`;
      }
    }

    content += `\n## Summary\n\n`;
    content += `- **Total Files:** ${files.length}\n`;
    content += `- **Generated:** ${new Date().toISOString()}\n`;
    content += `- **Category:** ${category}\n`;

    await writeFile(indexPath, content, "utf-8");
    console.log(`✅ Generated index: ${indexPath}`);
  }
}

function getCategoryTitle(category: string): string {
  const titles = {
    components: "Components",
    pages: "Pages",
    api: "API Routes",
    lib: "Libraries & Utilities",
  };

  return titles[category as keyof typeof titles] || category;
}

function getCategoryDescription(category: string): string {
  const descriptions = {
    components: "Reusable UI components used throughout the application.",
    pages: "Page components and routing logic.",
    api: "API endpoints and server-side logic.",
    lib: "Utility functions, helpers, and shared libraries.",
  };

  return descriptions[category as keyof typeof descriptions] || "";
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

function getUniqueFileName(file: FileInfo, category: string): string {
  const baseName = file.fileName.replace(/\.[^/.]+$/, ""); // Remove extension

  // Handle server actions: replace .action with -action in the baseName
  const processedBaseName = baseName.replace(/\.action/g, "-action");

  // For API routes, create descriptive names based on directory structure (Next.js file-based routing)
  if (category === "api") {
    const routePath = getRouteFromPath(file.relativePath);
    const httpMethod = getHttpMethodFromFile(file);

    if (routePath && httpMethod) {
      const actionName = getActionFromRoute(routePath, httpMethod);
      return `${httpMethod}-${actionName}.md`;
    }

    // Fallback: use baseName with api suffix
    return `${processedBaseName}-api.md`;
  }

  // For pages, create descriptive names based on directory structure
  if (category === "pages") {
    const routePath = getRouteFromPath(file.relativePath);
    if (routePath) {
      const cleanPath = routePath
        .replace(/[^a-zA-Z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      return `${cleanPath}-page.md`;
    }
    return `${processedBaseName}-page.md`;
  }

  // For components, add component prefix
  if (category === "components") {
    return `${processedBaseName}-component.md`;
  }

  // For lib/utilities, add utility prefix
  if (category === "lib") {
    return `${processedBaseName}-utility.md`;
  }

  // Default fallback
  return `${processedBaseName}.md`;
}

function addFrontmatter(
  content: string,
  file: FileInfo,
  category: string,
  config: any
): string {
  const title = file.fileName.replace(/\.[^/.]+$/, "");
  const description = getFileDescription(file, category);

  // Clean up content - remove markdown code block wrapper if present
  let cleanContent = content;
  if (content.startsWith("```markdown")) {
    cleanContent = content.replace(/^```markdown\n/, "").replace(/\n```$/, "");
  } else if (content.startsWith("```")) {
    cleanContent = content.replace(/^```\n/, "").replace(/\n```$/, "");
  }

  // Clean up problematic content that causes glitching
  cleanContent = cleanContent
    // Remove excessive equals signs and spaces (malformed tables)
    .replace(/={50,}/g, "") // Remove lines with 50+ equals signs
    .replace(/\s{20,}/g, " ") // Replace 20+ spaces with single space
    .replace(/\n\s*\n\s*\n/g, "\n\n") // Remove excessive blank lines
    // Remove malformed markdown tables
    .replace(
      /\|[^|]*\|[^|]*\|[^|]*\|\s*\n\s*\|[^|]*\|[^|]*\|[^|]*\|\s*\n\s*\|[^|]*\|[^|]*\|[^|]*\|\s*\n/g,
      ""
    )
    // Remove lines with only special characters
    .replace(/^[=\-\*_]{10,}$/gm, "")
    // Clean up excessive dashes
    .replace(/-{10,}/g, "---")
    // Remove any remaining problematic patterns
    .replace(/[^\x20-\x7E\n\t]/g, "") // Remove non-printable characters
    .trim();

  const frontmatter = `---
title: ${title}
description: ${description}
---

`;

  return frontmatter + cleanContent;
}

function getActionFromRoute(routePath: string, method: string): string {
  // Remove leading/trailing slashes and split by slashes
  const parts = routePath.replace(/^\/+|\/+$/g, "").split("/");

  // Handle common API patterns
  if (parts.length >= 2 && parts[0] === "api") {
    const resource = parts[1];

    // Handle CRUD operations
    if (method === "get" && parts.length === 2) {
      return `all-${resource}`; // GET /api/users -> get-all-users
    }
    if (
      method === "get" &&
      parts.length === 3 &&
      (parts[2] === ":id" || parts[2] === "[id]")
    ) {
      return `${resource}-by-id`; // GET /api/users/:id -> get-user-by-id
    }
    if (method === "post" && parts.length === 2) {
      return `create-${resource}`; // POST /api/users -> post-create-user
    }
    if (
      method === "put" &&
      parts.length === 3 &&
      (parts[2] === ":id" || parts[2] === "[id]")
    ) {
      return `update-${resource}`; // PUT /api/users/:id -> put-update-user
    }
    if (
      method === "delete" &&
      parts.length === 3 &&
      (parts[2] === ":id" || parts[2] === "[id]")
    ) {
      return `delete-${resource}`; // DELETE /api/users/:id -> delete-delete-user
    }

    // Handle specific actions
    if (parts.length >= 3) {
      const action = parts[2];
      return `${action}-${resource}`; // GET /api/users/search -> get-search-users
    }
  }

  // Handle auth routes
  if (routePath.includes("auth") || routePath.includes("login")) {
    return "auth";
  }
  if (routePath.includes("register")) {
    return "register";
  }

  // Handle other patterns
  const lastPart = parts[parts.length - 1];
  if (lastPart && lastPart !== ":id") {
    return lastPart.replace(/[^a-zA-Z0-9]/g, "-");
  }

  // Fallback: use the last meaningful part
  const meaningfulParts = parts.filter((p) => p && p !== ":id" && p !== "api");
  return meaningfulParts[meaningfulParts.length - 1] || "route";
}

function getFileDescription(file: FileInfo, category: string): string {
  const baseName = file.fileName.replace(/\.[^/.]+$/, "");

  switch (category) {
    case "components":
      return `${baseName} component - A reusable UI component`;
    case "pages":
      return getPageDescription(file);
    case "api":
      return getApiDescription(file);
    case "lib":
      return `${baseName} utility - Helper functions and utilities`;
    default:
      return `Documentation for ${baseName}`;
  }
}

function getApiDescription(file: FileInfo): string {
  // Extract route from directory structure (Next.js file-based routing)
  const routePath = getRouteFromPath(file.relativePath);
  const httpMethod = getHttpMethodFromFile(file);

  if (routePath && httpMethod) {
    const method = httpMethod.toUpperCase();

    // Try to extract description from comments (first comment only)
    const commentMatch = file.content.match(/\/\/\s*([^\n]+)/);
    if (commentMatch) {
      const comment = commentMatch[1].trim();
      // Limit comment length to avoid overly long descriptions
      const truncatedComment =
        comment.length > 100 ? comment.substring(0, 100) + "..." : comment;
      return `${method} ${routePath} - ${truncatedComment}`;
    }

    // Generate description based on route pattern
    const parts = routePath.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length >= 2 && parts[0] === "api") {
      const resource = parts[1];

      if (method === "GET" && parts.length === 2) {
        return `${method} ${routePath} - Retrieve all ${resource}`;
      }
      if (
        method === "GET" &&
        parts.length === 3 &&
        (parts[2] === "[id]" || parts[2] === ":id")
      ) {
        return `${method} ${routePath} - Retrieve ${resource} by ID`;
      }
      if (method === "POST" && parts.length === 2) {
        return `${method} ${routePath} - Create new ${resource}`;
      }
      if (
        method === "PUT" &&
        parts.length === 3 &&
        (parts[2] === "[id]" || parts[2] === ":id")
      ) {
        return `${method} ${routePath} - Update ${resource} by ID`;
      }
      if (
        method === "DELETE" &&
        parts.length === 3 &&
        (parts[2] === "[id]" || parts[2] === ":id")
      ) {
        return `${method} ${routePath} - Delete ${resource} by ID`;
      }

      // Handle specific API actions
      if (parts.length >= 3) {
        const action = parts[2];
        return `${method} ${routePath} - ${action} ${resource}`;
      }
    }

    return `${method} ${routePath} - API endpoint`;
  }

  const baseName = file.fileName.replace(/\.[^/.]+$/, "");
  return `${baseName} API endpoint - Server-side API route`;
}

function getPageDescription(file: FileInfo): string {
  // Extract route from directory structure (Next.js file-based routing)
  const routePath = getRouteFromPath(file.relativePath);

  if (routePath) {
    // Try to extract description from comments
    const commentMatch = file.content.match(/\/\/\s*(.+)/);
    if (commentMatch) {
      return `${routePath} - ${commentMatch[1]}`;
    }

    // Generate description based on route path
    const parts = routePath.replace(/^\/+|\/+$/g, "").split("/");
    const lastPart = parts[parts.length - 1];

    if (lastPart === "index" || lastPart === "page") {
      if (parts.length === 1) {
        return "/ - Home page";
      } else {
        const parentPath = "/" + parts.slice(0, -1).join("/");
        return `${parentPath} - Main page`;
      }
    }

    // Handle dynamic routes
    if (lastPart && lastPart.startsWith(":")) {
      const paramName = lastPart.slice(1);
      const parentPath = "/" + parts.slice(0, -1).join("/");
      return `${parentPath}/[${paramName}] - Dynamic page for ${paramName}`;
    }

    // Handle catch-all routes
    if (lastPart && lastPart.startsWith("*")) {
      const paramName = lastPart.slice(1);
      const parentPath = "/" + parts.slice(0, -1).join("/");
      return `${parentPath}/[...${paramName}] - Catch-all page for ${paramName}`;
    }

    return `${routePath} - Page component`;
  }

  const baseName = file.fileName.replace(/\.[^/.]+$/, "");
  return `${baseName} page - Application page component`;
}

function getRouteFromPath(relativePath: string): string {
  // Convert file path to route path (Next.js file-based routing)
  const parts = relativePath.split("/");

  // Remove file extensions and convert to route
  const routeParts = parts.map((part) => {
    // Remove file extension
    const withoutExt = part.replace(/\.[^/.]+$/, "");

    // Handle Next.js dynamic routes [id] -> :id
    if (withoutExt.startsWith("[") && withoutExt.endsWith("]")) {
      return `:${withoutExt.slice(1, -1)}`;
    }

    // Handle Next.js catch-all routes [...slug] -> *
    if (withoutExt.startsWith("[...") && withoutExt.endsWith("]")) {
      return `*${withoutExt.slice(4, -1)}`;
    }

    return withoutExt;
  });

  // Join with slashes and ensure it starts with /
  return "/" + routeParts.join("/");
}

function getHttpMethodFromFile(file: FileInfo): string {
  // For Next.js App Router, the HTTP method is determined by the file name
  const fileName = file.fileName.toLowerCase();

  // Check for Next.js App Router method files
  if (fileName === "route.ts" || fileName === "route.js") {
    // Look for HTTP method handlers in the file content
    const methodMatch = file.content.match(
      /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/i
    );
    if (methodMatch) {
      return methodMatch[1].toLowerCase();
    }

    // Default to GET for route.ts files
    return "get";
  }

  // Check for specific method files
  if (fileName.includes("get.")) return "get";
  if (fileName.includes("post.")) return "post";
  if (fileName.includes("put.")) return "put";
  if (fileName.includes("delete.")) return "delete";
  if (fileName.includes("patch.")) return "patch";

  // Check for method in file content (fallback)
  const methodMatch = file.content.match(
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/i
  );
  if (methodMatch) {
    return methodMatch[1].toLowerCase();
  }

  // Default to GET
  return "get";
}

async function generateAstroConfig(
  grouped: Record<string, FileInfo[]>,
  config: any,
  tempDir: string
): Promise<void> {
  const astroConfigPath = join(tempDir, "astro.config.mjs");

  // Generate sidebar configuration
  const sidebarConfig = generateSidebarConfig(grouped);

  const astroConfig = `// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: "${config.projectName}",
      sidebar: ${JSON.stringify(sidebarConfig, null, 2)},
      editLink: {
        base: "https://github.com/your-username/${
          config.projectName
        }/edit/main/",
        branch: "main",
        repo: "your-username/${config.projectName}",
      },
    }),
  ],
});
`;

  await writeFile(astroConfigPath, astroConfig, "utf-8");
  console.log(`✅ Generated Astro config: ${astroConfigPath}`);
}

function generateSidebarConfig(grouped: Record<string, FileInfo[]>): any[] {
  const sidebar: any[] = [];

  // Add API Reference section
  if (grouped.api && grouped.api.length > 0) {
    const apiItems = [
      { label: "Overview", link: "/api/" },
      ...grouped.api.map((file) => {
        const fileName = getUniqueFileName(file, "api");
        const routePath = getRouteFromPath(file.relativePath);
        const httpMethod = getHttpMethodFromFile(file);
        const method = httpMethod ? httpMethod.toUpperCase() : "API";
        const title = routePath || file.fileName.replace(/\.[^/.]+$/, "");

        return {
          label: `${method} ${title}`,
          link: `/api/${fileName.replace(".md", "")}/`,
        };
      }),
    ];

    sidebar.push({
      label: "API Reference",
      items: apiItems,
    });
  }

  // Add Components section
  if (grouped.components && grouped.components.length > 0) {
    const componentItems = [
      { label: "Overview", link: "/components/" },
      ...grouped.components.map((file) => {
        const fileName = getUniqueFileName(file, "components");
        const title = file.fileName.replace(/\.[^/.]+$/, "");

        return {
          label: title,
          link: `/components/${fileName.replace(".md", "")}/`,
        };
      }),
    ];

    sidebar.push({
      label: "Components",
      items: componentItems,
    });
  }

  // Add Pages section
  if (grouped.pages && grouped.pages.length > 0) {
    const pageItems = [
      { label: "Overview", link: "/pages/" },
      ...grouped.pages.map((file) => {
        const fileName = getUniqueFileName(file, "pages");
        const routePath = getRouteFromPath(file.relativePath);
        const title = routePath || file.fileName.replace(/\.[^/.]+$/, "");

        return {
          label: title,
          link: `/pages/${fileName.replace(".md", "")}/`,
        };
      }),
    ];

    sidebar.push({
      label: "Pages",
      items: pageItems,
    });
  }

  // Add Utilities section
  if (grouped.lib && grouped.lib.length > 0) {
    const utilityItems = [
      { label: "Overview", link: "/lib/" },
      ...grouped.lib.map((file) => {
        const fileName = getUniqueFileName(file, "lib");
        const title = file.fileName.replace(/\.[^/.]+$/, "");

        return {
          label: title,
          link: `/lib/${fileName.replace(".md", "")}/`,
        };
      }),
    ];

    sidebar.push({
      label: "Utilities",
      items: utilityItems,
    });
  }

  return sidebar;
}

async function moveContentToAstroProject(
  tempDir: string,
  outputDir: string
): Promise<void> {
  const { execSync } = await import("child_process");
  const { existsSync, rmSync } = await import("fs");

  console.log(`📁 Moving generated content to Astro project...`);

  try {
    // Remove existing content folder from Astro project
    const astroContentDir = join(outputDir, "src", "content");
    if (existsSync(astroContentDir)) {
      console.log(`🗑️  Removing existing content folder from Astro project...`);
      rmSync(astroContentDir, { recursive: true, force: true });
    }

    // Move content folder from temp to Astro project
    const tempContentDir = join(tempDir, "content");
    if (existsSync(tempContentDir)) {
      console.log(`📋 Moving content folder to Astro project...`);
      execSync(`cp -r "${tempContentDir}" "${join(outputDir, "src")}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    }

    // Move astro.config.mjs from temp to Astro project
    const tempAstroConfig = join(tempDir, "astro.config.mjs");
    const astroConfigDest = join(outputDir, "astro.config.mjs");
    if (existsSync(tempAstroConfig)) {
      console.log(`📋 Moving astro.config.mjs to Astro project...`);
      execSync(`cp "${tempAstroConfig}" "${astroConfigDest}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    }

    // Clean up temp directory
    console.log(`🧹 Cleaning up temporary directory...`);
    rmSync(tempDir, { recursive: true, force: true });

    console.log(`✅ Content moved successfully to Astro project`);
  } catch (error) {
    console.error(`❌ Failed to move content: ${error}`);
    console.log(`💡 Please move files manually:`);
    console.log(`   cp -r ${tempDir}/content ${outputDir}/src/`);
    console.log(`   cp ${tempDir}/astro.config.mjs ${outputDir}/`);
    console.log(`   rm -rf ${tempDir}`);
    process.exit(1);
  }
}

async function createAstroProject(
  outputDir: string,
  config: any
): Promise<void> {
  const { execSync } = await import("child_process");
  const { existsSync } = await import("fs");

  // Check if the output directory already exists
  if (existsSync(outputDir)) {
    console.log(
      `📁 Output directory ${outputDir} already exists, skipping Astro project creation`
    );
    return;
  }

  console.log(
    `🚀 Creating new Astro project with Starlight template in ${outputDir}...`
  );

  try {
    // Create Astro project with Starlight template
    execSync(
      `npm create astro@latest ${outputDir} -- --template starlight --yes --no-git`,
      {
        stdio: "inherit",
        cwd: process.cwd(),
      }
    );

    console.log(`✅ Astro project created successfully in ${outputDir}`);

    // Install dependencies
    console.log(`📦 Installing dependencies...`);
    execSync("npm install", {
      stdio: "inherit",
      cwd: outputDir,
    });

    console.log(`✅ Dependencies installed successfully`);
  } catch (error) {
    console.error(`❌ Failed to create Astro project: ${error}`);
    console.log(`💡 Please create the Astro project manually:`);
    console.log(
      `   npm create astro@latest ${outputDir} -- --template starlight --yes --no-git`
    );
    console.log(`   cd ${outputDir} && npm install`);
    process.exit(1);
  }
}
