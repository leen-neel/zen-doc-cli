import type { FileInfo } from "./fileRead.ts";

export function getCategoryPrompt(
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
- Document props using beautiful bullet points instead of tables:
  **Props:**
  - **name** (\`string\`, required) - The component name
  - **value** (\`number\`, optional, default: 0) - The component value
  - **disabled** (\`boolean\`, optional, default: false) - Whether the component is disabled
- Add "Examples" section with practical code snippets
- Use bullet points for all structured data (no tables)`;

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
- Include authentication and authorization details
- Use beautiful bullet points for parameters and responses (no tables):
  **Parameters:**
  - **id** (\`string\`, required) - The user ID
  - **email** (\`string\`, required) - The user's email address
  - **name** (\`string\`, optional) - The user's display name
- Use bullet points for all structured data (no tables)`;

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
- Include performance notes and best practices
- Use beautiful bullet points for parameters (no tables):
  **Parameters:**
  - **input** (\`string\`, required) - The input value to process
  - **options** (\`object\`, optional) - Configuration options
- Use bullet points for all structured data (no tables)`;

    default:
      return basePrompt;
  }
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
