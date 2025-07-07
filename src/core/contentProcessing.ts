import type { FileInfo } from "./fileRead.js";

export function addFrontmatter(
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
    // Remove excessive equals signs and spaces
    .replace(/={50,}/g, "") // Remove lines with 50+ equals signs
    .replace(/\s{20,}/g, " ") // Replace 20+ spaces with single space
    .replace(/\n\s*\n\s*\n/g, "\n\n") // Remove excessive blank lines
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

export function generateDocStructure(
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

export function generateFileDescription(file: FileInfo): string {
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

export function getCategorySections(category: string): string {
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

export function getFileDescription(file: FileInfo, category: string): string {
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

export function getApiDescription(file: FileInfo): string {
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

export function getPageDescription(file: FileInfo): string {
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

export function getRouteFromPath(relativePath: string): string {
  // Normalize path separators for cross-platform compatibility
  const normalizedPath = relativePath.replace(/[\/\\]/g, "/");

  // Convert file path to route path (Next.js file-based routing)
  const parts = normalizedPath.split("/");

  // Filter out temporary directory paths and other non-route parts
  const routeParts = parts
    .filter((part) => {
      // Remove temporary directory paths (temp-zen-docs-*)
      if (part.startsWith("temp-zen-docs-")) return false;
      // Remove content/docs paths
      if (part === "content" || part === "docs") return false;
      // Remove empty parts
      if (!part) return false;
      // Remove Next.js route groups (directories with parentheses)
      if (part.startsWith("(") && part.endsWith(")")) return false;
      return true;
    })
    .map((part) => {
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

export function getHttpMethodFromFile(file: FileInfo): string {
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
