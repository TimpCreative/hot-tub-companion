export type NotificationFeedCursor = { sentAt: string; id: string };

export function encodeNotificationFeedCursor(sentAt: Date | string, id: string): string {
  const iso = typeof sentAt === 'string' ? sentAt : sentAt.toISOString();
  return Buffer.from(JSON.stringify({ sentAt: iso, id }), 'utf8').toString('base64url');
}

export function decodeNotificationFeedCursor(raw: string | undefined): NotificationFeedCursor | null {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const json = Buffer.from(raw.trim(), 'base64url').toString('utf8');
    const o = JSON.parse(json) as { sentAt?: string; id?: string };
    if (typeof o.sentAt === 'string' && typeof o.id === 'string') return { sentAt: o.sentAt, id: o.id };
  } catch {
    return null;
  }
  return null;
}
