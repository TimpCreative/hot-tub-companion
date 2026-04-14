/**
 * Runtime polyfills loaded before app navigation mounts.
 *
 * React Navigation uses WeakRef in some code paths. Older JS runtimes may not
 * expose it, so provide a minimal fallback to avoid startup/runtime crashes.
 */

if (typeof (globalThis as { WeakRef?: unknown }).WeakRef === 'undefined') {
  class WeakRefFallback<T> {
    private value?: T;

    constructor(value: T) {
      this.value = value;
    }

    deref(): T | undefined {
      return this.value;
    }
  }

  (globalThis as { WeakRef?: unknown }).WeakRef = WeakRefFallback;
}
