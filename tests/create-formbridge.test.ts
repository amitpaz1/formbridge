/**
 * Feature 017 — CLI Scaffolding Tool Tests
 */

import { describe, it, expect } from "vitest";
import { parseArgs } from "../packages/create-formbridge/src/cli-args.js";
import {
  renderTemplate,
  toCamelCase,
  toPascalCase,
  type TemplateContext,
} from "../packages/create-formbridge/src/template-engine.js";
import { generateFiles } from "../packages/create-formbridge/src/generator.js";
import { TEMPLATE_CHOICES, AVAILABLE_TEMPLATE_IDS } from "../packages/create-formbridge/src/templates/index.js";

// =============================================================================
// § CLI Argument Parsing
// =============================================================================

describe("CLI Argument Parsing", () => {
  it("should parse --name argument", () => {
    const args = parseArgs(["--name", "my-project"]);
    expect(args.name).toBe("my-project");
  });

  it("should parse --schema argument", () => {
    const args = parseArgs(["--schema", "zod"]);
    expect(args.schema).toBe("zod");
  });

  it("should parse --interface with comma-separated values", () => {
    const args = parseArgs(["--interface", "mcp,http"]);
    expect(args.interfaces).toEqual(["mcp", "http"]);
  });

  it("should parse --template argument", () => {
    const args = parseArgs(["--template", "vendor-onboarding"]);
    expect(args.template).toBe("vendor-onboarding");
  });

  it("should parse all arguments together", () => {
    const args = parseArgs([
      "--name", "my-project",
      "--schema", "json-schema",
      "--interface", "http,mcp,react",
      "--template", "bug-report",
    ]);
    expect(args.name).toBe("my-project");
    expect(args.schema).toBe("json-schema");
    expect(args.interfaces).toEqual(["http", "mcp", "react"]);
    expect(args.template).toBe("bug-report");
  });

  it("should ignore invalid schema formats", () => {
    const args = parseArgs(["--schema", "invalid"]);
    expect(args.schema).toBeUndefined();
  });

  it("should filter out invalid interface types", () => {
    const args = parseArgs(["--interface", "http,invalid,mcp"]);
    expect(args.interfaces).toEqual(["http", "mcp"]);
  });

  it("should return empty interfaces for no arguments", () => {
    const args = parseArgs([]);
    expect(args.interfaces).toEqual([]);
    expect(args.name).toBeUndefined();
    expect(args.schema).toBeUndefined();
  });
});

// =============================================================================
// § Template Engine
// =============================================================================

describe("Template Engine", () => {
  const ctx: TemplateContext = {
    projectName: "my-intake",
    schemaFormat: "zod",
    interfaces: ["http", "mcp"],
    templateId: "none",
    camelName: "myIntake",
    pascalName: "MyIntake",
  };

  it("should replace {{variable}} placeholders", () => {
    const result = renderTemplate("Hello {{projectName}}", ctx);
    expect(result).toBe("Hello my-intake");
  });

  it("should replace multiple placeholders", () => {
    const result = renderTemplate(
      "{{pascalName}} uses {{schemaFormat}}",
      ctx
    );
    expect(result).toBe("MyIntake uses zod");
  });

  it("should leave unknown placeholders intact", () => {
    const result = renderTemplate("{{unknown}} is fine", ctx);
    expect(result).toBe("{{unknown}} is fine");
  });

  it("should handle hasHttp / hasMcp / hasReact booleans", () => {
    const result = renderTemplate(
      "http={{hasHttp}}, mcp={{hasMcp}}, react={{hasReact}}",
      ctx
    );
    expect(result).toBe("http=true, mcp=true, react=false");
  });
});

describe("Name Utilities", () => {
  it("should convert kebab-case to camelCase", () => {
    expect(toCamelCase("my-project")).toBe("myProject");
    expect(toCamelCase("vendor-onboarding")).toBe("vendorOnboarding");
  });

  it("should convert kebab-case to PascalCase", () => {
    expect(toPascalCase("my-project")).toBe("MyProject");
    expect(toPascalCase("vendor-onboarding")).toBe("VendorOnboarding");
  });

  it("should handle single word", () => {
    expect(toCamelCase("project")).toBe("project");
    expect(toPascalCase("project")).toBe("Project");
  });

  it("should strip leading @ and /", () => {
    expect(toCamelCase("@scope/my-pkg")).toBe("scopeMyPkg");
    expect(toPascalCase("@scope/my-pkg")).toBe("ScopeMyPkg");
  });
});

// =============================================================================
// § File Generation
// =============================================================================

describe("Project Generator", () => {
  it("should generate basic project files", () => {
    const files = generateFiles({
      name: "test-project",
      schema: "zod",
      interfaces: ["http"],
      template: "none",
    });

    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain("package.json");
    expect(paths).toContain("tsconfig.json");
    expect(paths).toContain("src/schema.ts");
    expect(paths).toContain("src/server.ts");
    expect(paths).toContain("README.md");
    expect(paths).toContain(".env.example");
    expect(paths).toContain(".gitignore");
  });

  it("should include MCP server when mcp interface is selected", () => {
    const files = generateFiles({
      name: "test-project",
      schema: "zod",
      interfaces: ["mcp"],
      template: "none",
    });

    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain("src/mcp-server.ts");
    expect(paths).not.toContain("src/server.ts");
    expect(paths).not.toContain("src/Form.tsx");
  });

  it("should include React form when react interface is selected", () => {
    const files = generateFiles({
      name: "test-project",
      schema: "zod",
      interfaces: ["react"],
      template: "none",
    });

    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain("src/Form.tsx");
  });

  it("should generate all interfaces when all selected", () => {
    const files = generateFiles({
      name: "test-project",
      schema: "zod",
      interfaces: ["http", "mcp", "react"],
      template: "none",
    });

    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain("src/server.ts");
    expect(paths).toContain("src/mcp-server.ts");
    expect(paths).toContain("src/Form.tsx");
  });

  it("should use json-schema extension for JSON Schema format", () => {
    const files = generateFiles({
      name: "test-project",
      schema: "json-schema",
      interfaces: ["http"],
      template: "none",
    });

    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain("src/schema.json.ts");
  });

  it("should use openapi extension for OpenAPI format", () => {
    const files = generateFiles({
      name: "test-project",
      schema: "openapi",
      interfaces: ["http"],
      template: "none",
    });

    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain("src/schema.openapi.ts");
  });

  it("should populate template variables in generated files", () => {
    const files = generateFiles({
      name: "my-intake",
      schema: "zod",
      interfaces: ["http"],
      template: "none",
    });

    const schemaFile = files.find((f) => f.relativePath === "src/schema.ts");
    expect(schemaFile).toBeDefined();
    expect(schemaFile!.content).toContain("myIntakeSchema");
    expect(schemaFile!.content).toContain("MyIntakeData");
  });

  it("should reference template in schema when template is selected", () => {
    const files = generateFiles({
      name: "my-vendor",
      schema: "zod",
      interfaces: ["http"],
      template: "vendor-onboarding",
    });

    const schemaFile = files.find((f) => f.relativePath === "src/schema.ts");
    expect(schemaFile).toBeDefined();
    expect(schemaFile!.content).toContain("vendor-onboarding");
  });

  it("should include project name in package.json", () => {
    const files = generateFiles({
      name: "my-intake",
      schema: "zod",
      interfaces: ["http"],
      template: "none",
    });

    const pkgFile = files.find((f) => f.relativePath === "package.json");
    expect(pkgFile).toBeDefined();
    const pkg = JSON.parse(pkgFile!.content);
    expect(pkg.name).toBe("my-intake");
    expect(pkg.dependencies).toHaveProperty("hono");
  });

  it("should add react dependencies when react interface selected", () => {
    const files = generateFiles({
      name: "my-intake",
      schema: "zod",
      interfaces: ["react"],
      template: "none",
    });

    const pkgFile = files.find((f) => f.relativePath === "package.json");
    const pkg = JSON.parse(pkgFile!.content);
    expect(pkg.dependencies).toHaveProperty("react");
    expect(pkg.dependencies).toHaveProperty("react-dom");
  });
});

// =============================================================================
// § Template Catalog
// =============================================================================

describe("Template Catalog", () => {
  it("should have 5 template choices", () => {
    expect(TEMPLATE_CHOICES).toHaveLength(5);
  });

  it("should include expected template IDs", () => {
    expect(AVAILABLE_TEMPLATE_IDS).toContain("vendor-onboarding");
    expect(AVAILABLE_TEMPLATE_IDS).toContain("it-access-request");
    expect(AVAILABLE_TEMPLATE_IDS).toContain("customer-intake");
    expect(AVAILABLE_TEMPLATE_IDS).toContain("expense-report");
    expect(AVAILABLE_TEMPLATE_IDS).toContain("bug-report");
  });

  it("each template choice should have value, label, and hint", () => {
    for (const choice of TEMPLATE_CHOICES) {
      expect(choice.value).toBeTruthy();
      expect(choice.label).toBeTruthy();
      expect(choice.hint).toBeTruthy();
    }
  });
});
