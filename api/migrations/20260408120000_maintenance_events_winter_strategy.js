exports.up = async function (knex) {
  await knex.schema.alterTable('spa_profiles', (table) => {
    table.string('winter_strategy', 20).notNullable().defaultTo('operate');
  });

  await knex.schema.createTable('maintenance_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('spa_profile_id').notNullable().references('id').inTable('spa_profiles').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('event_type', 50).notNullable();
    table.string('title', 255).notNullable();
    table.text('description');
    table.date('due_date').notNullable();
    table.timestamp('completed_at');
    table.boolean('is_recurring').notNullable().defaultTo(false);
    table.integer('recurrence_interval_days');
    table.boolean('notification_sent').notNullable().defaultTo(false);
    table.integer('notification_days_before').notNullable().defaultTo(3);
    table.string('linked_product_category', 50);
    table.string('source', 20).notNullable().defaultTo('auto');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    'CREATE INDEX idx_maint_spa_due ON maintenance_events (spa_profile_id, due_date)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_maint_notify_pending ON maintenance_events (due_date) WHERE completed_at IS NULL AND notification_sent = false'
  );
};

exports.down = async function (knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_maint_notify_pending');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_maint_spa_due');
  await knex.schema.dropTableIfExists('maintenance_events');
  await knex.schema.alterTable('spa_profiles', (table) => {
    table.dropColumn('winter_strategy');
  });
};
