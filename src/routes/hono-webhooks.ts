/**
 * Webhook delivery routes.
 * Provides HTTP endpoints for querying delivery status.
 */

import { Hono } from "hono";
import type { WebhookManager } from "../core/webhook-manager.js";

/**
 * Create a Hono router for webhook delivery endpoints.
 */
export function createHonoWebhookRouter(
  webhookManager: WebhookManager
): Hono {
  const router = new Hono();

  // GET /submissions/:id/deliveries — list deliveries for a submission
  router.get("/submissions/:id/deliveries", async (c) => {
    const submissionId = c.req.param("id");
    const deliveries = await webhookManager.getDeliveries(submissionId);

    return c.json({
      ok: true,
      submissionId,
      deliveries,
      total: deliveries.length,
    });
  });

  // GET /webhooks/deliveries/:deliveryId — get a single delivery
  router.get("/webhooks/deliveries/:deliveryId", async (c) => {
    const deliveryId = c.req.param("deliveryId");
    const delivery = await webhookManager.getDelivery(deliveryId);

    if (!delivery) {
      return c.json(
        {
          ok: false,
          error: {
            type: "not_found",
            message: `Delivery '${deliveryId}' not found`,
          },
        },
        404
      );
    }

    return c.json({
      ok: true,
      delivery,
    });
  });

  // POST /webhooks/deliveries/:deliveryId/retry — retry a failed delivery
  router.post("/webhooks/deliveries/:deliveryId/retry", async (c) => {
    const deliveryId = c.req.param("deliveryId");
    const delivery = await webhookManager.getDelivery(deliveryId);

    if (!delivery) {
      return c.json(
        {
          ok: false,
          error: {
            type: "not_found",
            message: `Delivery '${deliveryId}' not found`,
          },
        },
        404
      );
    }

    if (delivery.status !== "failed") {
      return c.json(
        {
          ok: false,
          error: {
            type: "conflict",
            message: `Delivery is in '${delivery.status}' state, only failed deliveries can be retried`,
          },
        },
        409
      );
    }

    // Reset delivery for retry
    delivery.status = "pending";
    delivery.attempts = 0;
    delivery.error = undefined;
    delivery.nextRetryAt = undefined;
    const queue = webhookManager.getQueue();
    await queue.update(delivery);

    return c.json({
      ok: true,
      deliveryId,
      status: "pending",
      message: "Delivery queued for retry",
    });
  });

  return router;
}
