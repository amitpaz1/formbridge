# Tool Generation

FormBridge generates MCP tools from intake schema definitions.

## Generated Tools

For each intake, the following tools are generated:
- `create_{intakeId}_submission` — Create a new submission
- `set_{intakeId}_fields` — Update field values
- `submit_{intakeId}` — Submit for processing
- `get_{intakeId}_status` — Check submission status

## Tool Schema

Each tool includes full JSON Schema for its input parameters, derived from the intake schema.
