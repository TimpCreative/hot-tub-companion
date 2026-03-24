/**
 * Permission presets for admin roles. Used when creating/updating admin_roles.
 */
export interface AdminPermissions {
  can_view_customers: boolean;
  can_view_orders: boolean;
  can_manage_products: boolean;
  can_manage_content: boolean;
  can_manage_service_requests: boolean;
  can_send_notifications: boolean;
  can_view_analytics: boolean;
  can_manage_subscriptions: boolean;
  can_manage_settings: boolean;
  can_manage_users: boolean;
}

export const ROLE_TEMPLATES: Record<string, AdminPermissions> = {
  owner: {
    can_view_customers: true,
    can_view_orders: true,
    can_manage_products: true,
    can_manage_content: true,
    can_manage_service_requests: true,
    can_send_notifications: true,
    can_view_analytics: true,
    can_manage_subscriptions: true,
    can_manage_settings: true,
    can_manage_users: true,
  },
  manager: {
    can_view_customers: true,
    can_view_orders: true,
    can_manage_products: true,
    can_manage_content: true,
    can_manage_service_requests: true,
    can_send_notifications: true,
    can_view_analytics: true,
    can_manage_subscriptions: true,
    can_manage_settings: true,
    can_manage_users: false,
  },
  support: {
    can_view_customers: true,
    can_view_orders: true,
    can_manage_products: false,
    can_manage_content: false,
    can_manage_service_requests: true,
    can_send_notifications: true,
    can_view_analytics: true,
    can_manage_subscriptions: false,
    can_manage_settings: false,
    can_manage_users: false,
  },
  viewer: {
    can_view_customers: true,
    can_view_orders: true,
    can_manage_products: false,
    can_manage_content: false,
    can_manage_service_requests: false,
    can_send_notifications: false,
    can_view_analytics: true,
    can_manage_subscriptions: false,
    can_manage_settings: false,
    can_manage_users: false,
  },
};

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  support: 'Support',
  viewer: 'Viewer',
};
