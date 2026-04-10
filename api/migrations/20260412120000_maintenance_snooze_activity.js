/**
 * Snooze support, activity audit log, soft-delete for custom maintenance tasks.
 * @param { import("knex").Knex } knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('maintenance_events', (table) => {
    table.timestamp('snoozed_until', { useTz: true }).nullable();
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });

  await knex.schema.createTable('maintenance_activity', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('spa_profile_id').notNullable().references('id').inTable('spa_profiles').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('maintenance_event_id').nullable();
    table.string('action', 40).notNullable();
    table.jsonb('payload').notNullable().defaultTo('{}');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    'CREATE INDEX idx_maintenance_activity_spa_created ON maintenance_activity (spa_profile_id, created_at DESC)'
  );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function down(knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_maintenance_activity_spa_created');
  await knex.schema.dropTableIfExists('maintenance_activity');
  await knex.schema.alterTable('maintenance_events', (table) => {
    table.dropColumn('snoozed_until');
    table.dropColumn('deleted_at');
  });
};
