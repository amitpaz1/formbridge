/**
 * Project generator — creates the scaffold project directory structure.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { CliArgs, SchemaFormat } from "./cli-args.js";
import {
  renderTemplate,
  toCamelCase,
  toPascalCase,
  type TemplateContext,
} from "./template-engine.js";
import {
  getPackageJson,
  getTsConfig,
  getSchemaFile,
  getServerFile,
  getMcpFile,
  getReactFile,
  getReadme,
  getEnvExample,
} from "./templates/file-generators.js";

export interface GeneratedFile {
  relativePath: string;
  content: string;
}

/**
 * Generate and write the project to disk.
 */
export async function generateProject(
  options: Required<CliArgs>
): Promise<string> {
  const projectDir = path.resolve(process.cwd(), options.name);

  if (fs.existsSync(projectDir)) {
    const entries = fs.readdirSync(projectDir);
    if (entries.length > 0) {
      throw new Error(
        `Directory "${options.name}" already exists and is not empty.`
      );
    }
  }

  const files = generateFiles(options);

  for (const file of files) {
    const filePath = path.join(projectDir, file.relativePath);
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, file.content, "utf-8");
  }

  console.log(`\nProject created at ${projectDir}`);
  console.log(`\nNext steps:`);
  console.log(`  cd ${options.name}`);
  console.log(`  npm install`);
  console.log(`  npm run dev\n`);

  return projectDir;
}

/**
 * Generate all project files (pure — no I/O).
 */
export function generateFiles(options: Required<CliArgs>): GeneratedFile[] {
  const ctx: TemplateContext = {
    projectName: options.name,
    schemaFormat: options.schema,
    interfaces: options.interfaces,
    templateId: options.template,
    camelName: toCamelCase(options.name),
    pascalName: toPascalCase(options.name),
  };

  const files: GeneratedFile[] = [];

  // package.json
  files.push({
    relativePath: "package.json",
    content: getPackageJson(ctx),
  });

  // tsconfig.json
  files.push({
    relativePath: "tsconfig.json",
    content: getTsConfig(),
  });

  // Schema file
  files.push({
    relativePath: `src/schema.${getSchemaExtension(options.schema)}`,
    content: renderTemplate(getSchemaFile(options.schema, options.template), ctx),
  });

  // HTTP server (if selected)
  if (options.interfaces.includes("http")) {
    files.push({
      relativePath: "src/server.ts",
      content: renderTemplate(getServerFile(), ctx),
    });
  }

  // MCP server (if selected)
  if (options.interfaces.includes("mcp")) {
    files.push({
      relativePath: "src/mcp-server.ts",
      content: renderTemplate(getMcpFile(), ctx),
    });
  }

  // React form (if selected)
  if (options.interfaces.includes("react")) {
    files.push({
      relativePath: "src/Form.tsx",
      content: renderTemplate(getReactFile(), ctx),
    });
  }

  // README
  files.push({
    relativePath: "README.md",
    content: renderTemplate(getReadme(), ctx),
  });

  // .env.example
  files.push({
    relativePath: ".env.example",
    content: getEnvExample(),
  });

  // .gitignore
  files.push({
    relativePath: ".gitignore",
    content: "node_modules\ndist\n.env\n",
  });

  return files;
}

function getSchemaExtension(schema: SchemaFormat): string {
  switch (schema) {
    case "zod":
      return "ts";
    case "json-schema":
      return "json.ts";
    case "openapi":
      return "openapi.ts";
  }
}
