exports.up = async function (knex) {
  await knex.schema.createTable('notification_security_audit', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('SET NULL');
    table.uuid('actor_user_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('actor_email', 255);
    table.string('actor_role', 40);
    table.string('event_type', 80).notNullable();
    table.string('outcome', 20).notNullable();
    table.string('request_id', 64);
    table.string('ip_hash', 128);
    table.string('user_agent_hash', 128);
    table.jsonb('details');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    'CREATE INDEX idx_notification_security_audit_tenant_created ON notification_security_audit(tenant_id, created_at DESC)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_notification_security_audit_event ON notification_security_audit(event_type, created_at DESC)'
  );
};

exports.down = async function (knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_notification_security_audit_event');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_notification_security_audit_tenant_created');
  await knex.schema.dropTableIfExists('notification_security_audit');
};
