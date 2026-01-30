# React Form Renderer

The `@formbridge/form-renderer` package provides React components for rendering forms from intake schemas.

## Installation

```bash
npm install @formbridge/form-renderer
```

## Usage

```tsx
import { FormBridgeForm } from '@formbridge/form-renderer';

function MyForm() {
  return (
    <FormBridgeForm
      schema={intakeSchema}
      onSubmit={handleSubmit}
    />
  );
}
```
