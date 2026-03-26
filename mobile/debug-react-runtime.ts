/**
 * Loads before other app modules via _layout import order.
 * Debug session: posts React resolution probe (do not log secrets).
 */
import React from 'react';
import { NativeModules, Platform } from 'react-native';

export function agentIngestUrl(): string {
  let host = '127.0.0.1';
  try {
    const su = NativeModules?.SourceCode?.scriptURL as string | undefined;
    if (su && (su.startsWith('http://') || su.startsWith('https://'))) {
      host = new URL(su).hostname;
    }
  } catch {
    /* ignore */
  }
  return `http://${host}:7244/ingest/a47da7ba-8944-40d5-a7b1-3ca8dd181a2c`;
}

export function postAgentDebug(payload: {
  hypothesisId: string;
  location: string;
  message: string;
  runId?: string;
  data: Record<string, unknown>;
}): void {
  // #region agent log
  fetch(agentIngestUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '8c62d1',
    },
    body: JSON.stringify({
      sessionId: '8c62d1',
      runId: payload.runId ?? 'pre-fix',
      hypothesisId: payload.hypothesisId,
      location: payload.location,
      message: payload.message,
      data: payload.data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

let resolveReact: string | null = null;
try {
  // Metro may or may not define this; safe probe only.
  // @ts-expect-error Metro optional
  resolveReact = typeof require.resolve === 'function' ? require.resolve('react') : null;
} catch {
  resolveReact = 'resolve-failed';
}

const probeData = {
  reactVersion: React.version,
  resolveReact,
  scriptURLHost: (() => {
    try {
      const su = NativeModules?.SourceCode?.scriptURL as string | undefined;
      if (su && (su.startsWith('http://') || su.startsWith('https://'))) {
        return new URL(su).hostname;
      }
      return su ? 'non-http-scriptURL' : 'no-scriptURL';
    } catch {
      return 'parse-error';
    }
  })(),
  platform: Platform.OS,
  expectsRN: '19.1.0',
};

// #region agent log
postAgentDebug({
  hypothesisId: 'H1-H3-H4-H5',
  location: 'debug-react-runtime.ts:boot',
  message: 'React/Metro probe at app boot',
  data: probeData,
});
// #endregion

if (__DEV__) {
  console.warn('[AGENT_DEBUG] React probe', probeData);
}
