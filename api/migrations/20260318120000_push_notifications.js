/**
 * Push notifications: scheduled_notifications, notification_log, global_push_announcements.
 * Adds shopify_webhook_secret to tenants for webhook HMAC verification.
 */

exports.up = async function (knex) {
  await knex.schema.table('tenants', (table) => {
    table.text('shopify_webhook_secret');
  });

  await knex.schema.createTable('scheduled_notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.string('created_by_email', 255);

    table.string('title', 255).notNullable();
    table.text('body').notNullable();
    table.string('link_type', 30);
    table.string('link_id', 255);

    table.string('target', 30).notNullable().defaultTo('all_customers');
    table.jsonb('target_segment');

    table.timestamp('send_at', { useTz: true }).notNullable();
    table.timestamp('sent_at', { useTz: true });
    table.string('status', 20).defaultTo('scheduled');

    table.integer('recipients_count').defaultTo(0);
    table.integer('delivered_count').defaultTo(0);

    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.schema.raw('CREATE INDEX idx_scheduled_notifications_tenant ON scheduled_notifications(tenant_id)');
  await knex.schema.raw('CREATE INDEX idx_scheduled_notifications_status ON scheduled_notifications(status)');
  await knex.schema.raw(
    "CREATE INDEX idx_scheduled_notifications_due ON scheduled_notifications(send_at) WHERE status = 'scheduled'"
  );

  await knex.schema.createTable('notification_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('SET NULL');
    table.uuid('recipient_user_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('title', 255).notNullable();
    table.text('body');
    table.string('type', 50).notNullable();
    table.timestamp('sent_at', { useTz: true }).defaultTo(knex.fn.now());
    table.string('created_by_type', 20);
    table.string('created_by_id', 255);
  });
  await knex.schema.raw('CREATE INDEX idx_notification_log_tenant ON notification_log(tenant_id)');
  await knex.schema.raw('CREATE INDEX idx_notification_log_recipient ON notification_log(recipient_user_id)');

  await knex.schema.createTable('global_push_announcements', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('created_by_email', 255).notNullable();
    table.string('target', 30).notNullable();
    table.uuid('target_tenant_id').references('id').inTable('tenants').onDelete('SET NULL');
    table.string('title', 255).notNullable();
    table.text('body').notNullable();
    table.timestamp('sent_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('global_push_announcements');
  await knex.schema.dropTableIfExists('notification_log');
  await knex.schema.dropTableIfExists('scheduled_notifications');
  await knex.schema.table('tenants', (table) => {
    table.dropColumn('shopify_webhook_secret');
  });
};
