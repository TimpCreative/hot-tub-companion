/**
 * Inbox Notifications MVP: read state + deep-link payload on notification_log.
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('notification_log', (table) => {
    table.timestamp('read_at', { useTz: true });
    table.jsonb('payload');
  });
  await knex.schema.raw(
    'CREATE INDEX idx_notification_log_recipient_sent ON notification_log(recipient_user_id, sent_at DESC)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_notification_log_tenant_sent ON notification_log(tenant_id, sent_at DESC)'
  );
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_notification_log_recipient_sent').catch(() => {});
  await knex.raw('DROP INDEX IF EXISTS idx_notification_log_tenant_sent').catch(() => {});
  await knex.schema.alterTable('notification_log', (table) => {
    table.dropColumn('read_at');
    table.dropColumn('payload');
  });
};
