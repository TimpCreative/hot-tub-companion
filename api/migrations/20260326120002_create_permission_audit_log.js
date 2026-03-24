/**
 * Creates permission_audit_log for tracking who changed permissions.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('permission_audit_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('SET NULL');
    table.uuid('actor_user_id');
    table.string('actor_email', 255);
    table.string('action', 50).notNullable(); // admin_added, admin_updated, admin_removed, platform_user_added, etc.
    table.uuid('target_user_id');
    table.string('target_email', 255);
    table.jsonb('changes'); // { before: {...}, after: {...} }
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX idx_permission_audit_tenant ON permission_audit_log(tenant_id, created_at DESC)');
  await knex.raw('CREATE INDEX idx_permission_audit_actor ON permission_audit_log(actor_email, created_at DESC)');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('permission_audit_log');
};
