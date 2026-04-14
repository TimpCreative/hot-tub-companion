import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { notificationTypeToCategory } from '../utils/notificationCategory';

describe('notificationTypeToCategory', () => {
  it('maps known types', () => {
    assert.equal(notificationTypeToCategory('maintenance_reminder'), 'maintenance');
    assert.equal(notificationTypeToCategory('order'), 'order');
    assert.equal(notificationTypeToCategory('promotional'), 'retailer');
    assert.equal(notificationTypeToCategory('welcome'), 'system');
  });

  it('defaults unknown types to system', () => {
    assert.equal(notificationTypeToCategory('unknown_future_type'), 'system');
  });
});
