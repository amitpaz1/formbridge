/**
 * Test HTTP Server
 * Runs FormBridge locally with sample intake definitions for development/testing
 */

import { serve } from "@hono/node-server";
import { createFormBridgeAppWithIntakes } from "./app.js";
import type { IntakeDefinition } from "./types.js";

// Sample vendor onboarding intake
const vendorOnboarding: IntakeDefinition = {
  id: "vendor-onboarding",
  version: "1.0.0",
  name: "Vendor Onboarding",
  description: "Onboard new vendors with tax ID, bank account, and documentation",
  schema: {
    type: "object",
    properties: {
      legal_name: { type: "string", minLength: 1, description: "Legal business name" },
      country: { type: "string", enum: ["US", "CA", "UK", "DE", "FR"], description: "Country code" },
      tax_id: { type: "string", pattern: "^[0-9]{2}-[0-9]{7}$", description: "Tax ID (XX-XXXXXXX)" },
      contact_email: { type: "string", format: "email", description: "Contact email" },
      bank_account: {
        type: "object",
        properties: {
          routing: { type: "string", description: "Routing number" },
          account: { type: "string", description: "Account number" },
        },
        required: ["routing", "account"],
      },
      business_type: {
        type: "string",
        enum: ["sole_proprietor", "llc", "corporation", "partnership"],
        description: "Business entity type",
      },
    },
    required: ["legal_name", "country", "tax_id", "contact_email"],
  },
  destination: {
    kind: "webhook",
    url: "https://example.com/vendor-webhook",
  },
};

// Simple contact form intake
const contactForm: IntakeDefinition = {
  id: "contact-form",
  version: "1.0.0",
  name: "Contact Form",
  description: "Simple contact form",
  schema: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, description: "Your name" },
      email: { type: "string", format: "email", description: "Your email" },
      message: { type: "string", minLength: 10, description: "Your message" },
    },
    required: ["name", "email", "message"],
  },
  destination: {
    kind: "webhook",
    url: "https://example.com/contact-webhook",
  },
};

const app = createFormBridgeAppWithIntakes(
  [vendorOnboarding, contactForm],
  { cors: { origin: "*", allowMethods: ["GET", "POST", "PATCH", "OPTIONS"] } }
);

const PORT = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`\n🌉 FormBridge dev server running at http://localhost:${PORT}\n`);
  console.log("Available intakes:");
  console.log("  GET  /health");
  console.log("  GET  /intake/vendor-onboarding/schema");
  console.log("  GET  /intake/contact-form/schema");
  console.log("  POST /intake/vendor-onboarding/submissions");
  console.log("  POST /intake/contact-form/submissions");
  console.log("");
});

export default app;
