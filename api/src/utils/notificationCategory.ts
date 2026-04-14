/**
 * Maps notification_log.type to stable UI categories (Part 7).
 */
export type NotificationCategory = 'maintenance' | 'order' | 'retailer' | 'system' | 'promotional';

const TYPE_TO_CATEGORY: Record<string, NotificationCategory> = {
  maintenance_reminder: 'maintenance',
  order: 'order',
  welcome: 'system',
  global_announcement: 'system',
  promotional: 'retailer',
};

export function notificationTypeToCategory(type: string): NotificationCategory {
  return TYPE_TO_CATEGORY[type] ?? 'system';
}
