import type { PosAdapter } from '../types/uhtd.types';

/**
 * Central registry for POS adapters.
 *
 * In Phase 1 we only have a Shopify adapter, but this registry is designed
 * so that additional providers (e.g. Lightspeed, CSV, custom APIs) can be
 * wired in without changing downstream call sites.
 */

const adapters: Record<string, PosAdapter> = {};

/**
 * Register a POS adapter implementation for a given provider key.
 * Typical keys are lowercase identifiers like 'shopify' or 'lightspeed'.
 */
export function registerPosAdapter(providerKey: string, adapter: PosAdapter): void {
  adapters[providerKey] = adapter;
}

/**
 * Resolve the adapter for a given provider key. Returns null when no
 * adapter has been registered or when the provider key is missing.
 */
export function getPosAdapter(providerKey?: string | null): PosAdapter | null {
  if (!providerKey) return null;
  return adapters[providerKey] ?? null;
}

