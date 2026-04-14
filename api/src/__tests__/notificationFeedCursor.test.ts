import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decodeNotificationFeedCursor,
  encodeNotificationFeedCursor,
} from '../utils/notificationFeedCursor';

describe('notificationFeedCursor', () => {
  it('roundtrips sentAt and id', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const sentAt = new Date('2026-04-13T12:00:00.000Z');
    const enc = encodeNotificationFeedCursor(sentAt, id);
    const dec = decodeNotificationFeedCursor(enc);
    assert.ok(dec);
    assert.equal(dec!.id, id);
    assert.equal(dec!.sentAt, sentAt.toISOString());
  });

  it('returns null for invalid cursor', () => {
    assert.equal(decodeNotificationFeedCursor(undefined), null);
    assert.equal(decodeNotificationFeedCursor('not-valid'), null);
  });
});
