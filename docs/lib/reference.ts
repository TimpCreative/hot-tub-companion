import { readFileSync } from 'fs';
import path from 'path';

export interface ReferenceItem {
  operationId: string;
  slug: string;
  method: string;
  path: string;
  domain: string;
  group: string;
  authType: string;
  source: string;
  summary: string;
  rationale: string;
  gotchas: string[];
  dashboardUsage: string[];
  mobileUsage: string[];
}

function readJson<T>(relativePath: string, fallback: T): T {
  const full = path.join(process.cwd(), relativePath);
  try {
    return JSON.parse(readFileSync(full, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function readReferenceIndex(): ReferenceItem[] {
  return readJson<ReferenceItem[]>('content/reference/index.json', []);
}

export function readReferenceContent(slug: string): string {
  const full = path.join(process.cwd(), 'content', 'reference', 'operations', `${slug}.mdx`);
  return readFileSync(full, 'utf8');
}
