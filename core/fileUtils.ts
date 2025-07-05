import type { FileInfo } from "./fileRead";
import { getRouteFromPath, getHttpMethodFromFile } from "./contentProcessing";

export function groupFilesByCategory(
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

export function getUniqueFileName(file: FileInfo, category: string): string {
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

export function getActionFromRoute(routePath: string, method: string): string {
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

export function getCategoryTitle(category: string): string {
  const titles = {
    components: "Components",
    pages: "Pages",
    api: "API Routes",
    lib: "Libraries & Utilities",
  };

  return titles[category as keyof typeof titles] || category;
}

export function getCategoryDescription(category: string): string {
  const descriptions = {
    components: "Reusable UI components used throughout the application.",
    pages: "Page components and routing logic.",
    api: "API endpoints and server-side logic.",
    lib: "Utility functions, helpers, and shared libraries.",
  };

  return descriptions[category as keyof typeof descriptions] || "";
}
