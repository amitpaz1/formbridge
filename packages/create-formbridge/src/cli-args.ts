/**
 * CLI argument parser for non-interactive mode.
 */

export type SchemaFormat = "zod" | "json-schema" | "openapi";
export type InterfaceType = "react" | "mcp" | "http";

export interface CliArgs {
  name?: string;
  schema?: SchemaFormat;
  interfaces: InterfaceType[];
  template?: string;
}

const VALID_SCHEMAS: SchemaFormat[] = ["zod", "json-schema", "openapi"];
const VALID_INTERFACES: InterfaceType[] = ["react", "mcp", "http"];

export function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = { interfaces: [] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "--name":
        if (next) {
          result.name = next;
          i++;
        }
        break;

      case "--schema":
        if (next && VALID_SCHEMAS.includes(next as SchemaFormat)) {
          result.schema = next as SchemaFormat;
          i++;
        }
        break;

      case "--interface":
        if (next) {
          const parts = next.split(",").map((s) => s.trim()) as InterfaceType[];
          result.interfaces = parts.filter((p) => VALID_INTERFACES.includes(p));
          i++;
        }
        break;

      case "--template":
        if (next) {
          result.template = next;
          i++;
        }
        break;
    }
  }

  return result;
}
