/**
 * Interactive prompts using @clack/prompts.
 */

import * as p from "@clack/prompts";
import type { CliArgs, SchemaFormat, InterfaceType } from "./cli-args.js";
import { TEMPLATE_CHOICES } from "./templates/index.js";

export async function runInteractive(
  defaults: CliArgs
): Promise<Required<CliArgs>> {
  p.intro("Create a new FormBridge project");

  const answers = await p.group(
    {
      name: () =>
        p.text({
          message: "Project name",
          placeholder: "my-formbridge-intake",
          initialValue: defaults.name ?? "",
          validate: (value) => {
            if (!value) return "Project name is required";
            if (!/^[a-z0-9@][a-z0-9._/-]*$/.test(value))
              return "Invalid package name (lowercase, no spaces)";
          },
        }),

      schema: () =>
        p.select({
          message: "Schema format",
          initialValue: defaults.schema ?? "zod",
          options: [
            { value: "zod", label: "Zod", hint: "TypeScript-first validation" },
            { value: "json-schema", label: "JSON Schema", hint: "Standard JSON Schema" },
            { value: "openapi", label: "OpenAPI", hint: "OpenAPI 3.x schema component" },
          ],
        }),

      interfaces: () =>
        p.multiselect({
          message: "Interfaces to generate",
          initialValues:
            defaults.interfaces.length > 0 ? defaults.interfaces : ["http"],
          options: [
            { value: "http", label: "HTTP API", hint: "Hono-based REST endpoints" },
            { value: "mcp", label: "MCP Server", hint: "Model Context Protocol tools" },
            { value: "react", label: "React Form", hint: "React form renderer" },
          ],
          required: true,
        }),

      template: () =>
        p.select({
          message: "Starting template",
          initialValue: defaults.template ?? "none",
          options: [
            { value: "none", label: "Blank project", hint: "Start from scratch" },
            ...TEMPLATE_CHOICES,
          ],
        }),
    },
    {
      onCancel: () => {
        p.cancel("Project creation cancelled.");
        process.exit(0);
      },
    }
  );

  p.outro("Generating project...");

  return {
    name: answers.name as string,
    schema: answers.schema as SchemaFormat,
    interfaces: answers.interfaces as InterfaceType[],
    template: (answers.template as string) ?? "none",
  };
}
