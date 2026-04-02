/**
 * POS integration activity log for support and confirmation that sync/webhooks work.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.timestamp('pos_integration_last_activity_at').nullable();
  });

  await knex.schema.createTable('pos_integration_activity', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('event_type', 64).notNullable();
    table.string('summary', 500).notNullable();
    table.jsonb('metadata').nullable();
    table.string('source', 32).notNullable();
    table.uuid('actor_user_id').nullable();
    table.string('actor_label', 320).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    'CREATE INDEX idx_pos_integration_activity_tenant_created ON pos_integration_activity(tenant_id, created_at DESC)'
  );
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('pos_integration_activity');
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('pos_integration_last_activity_at');
  });
};
