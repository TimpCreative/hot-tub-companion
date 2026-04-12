import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../config/environment';
import { getStripe, isStripeConfigured } from '../services/stripeClient.service';
import { processStripeWebhookEvent } from '../services/stripeWebhook.service';
import { success } from '../utils/response';

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!isStripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: 'Stripe webhook not configured' });
    return;
  }
  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    res.status(400).json({ error: 'Missing stripe-signature' });
    return;
  }
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!raw || !Buffer.isBuffer(raw)) {
    res.status(400).json({ error: 'Missing raw body' });
    return;
  }
  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripeWebhook] signature', err);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }
  try {
    await processStripeWebhookEvent(event);
    success(res, { received: true });
  } catch (e) {
    console.error('[stripeWebhook] process', e);
    res.status(500).json({ error: 'Processing failed' });
  }
}
