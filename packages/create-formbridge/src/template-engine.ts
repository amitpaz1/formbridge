/**
 * Template engine — simple {{variable}} substitution.
 */

export interface TemplateContext {
  projectName: string;
  schemaFormat: string;
  interfaces: string[];
  templateId: string;
  /** camelCase project name for variables */
  camelName: string;
  /** PascalCase project name for types */
  pascalName: string;
}

/**
 * Replace {{key}} placeholders in template content.
 */
export function renderTemplate(
  template: string,
  context: TemplateContext
): string {
  const vars: Record<string, string> = {
    projectName: context.projectName,
    schemaFormat: context.schemaFormat,
    interfaces: context.interfaces.join(", "),
    interfacesJson: JSON.stringify(context.interfaces),
    templateId: context.templateId,
    camelName: context.camelName,
    pascalName: context.pascalName,
    hasHttp: String(context.interfaces.includes("http")),
    hasMcp: String(context.interfaces.includes("mcp")),
    hasReact: String(context.interfaces.includes("react")),
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in vars ? vars[key] : match;
  });
}

/**
 * Convert a kebab-case or slug name to camelCase.
 */
export function toCamelCase(name: string): string {
  return name
    .replace(/^[@/]/, "")
    .split(/[-_./]/)
    .map((part, i) =>
      i === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join("");
}

/**
 * Convert a kebab-case or slug name to PascalCase.
 */
export function toPascalCase(name: string): string {
  return name
    .replace(/^[@/]/, "")
    .split(/[-_./]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}
