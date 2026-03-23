/**
 * Queue for consumer-submitted spa/UHTD data. Never writes to SCdb until super-admin approves manually.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('consumer_uhtd_suggestions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('status', 24).notNullable().defaultTo('pending');
    table.jsonb('payload').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('reviewed_at');
    table.string('reviewed_by_email', 255);
    table.text('review_notes');
    table.index(['tenant_id', 'status'], 'idx_consumer_uhtd_sugg_tenant_status');
    table.index(['status', 'created_at'], 'idx_consumer_uhtd_sugg_status_created');
  });

  await knex.schema.alterTable('spa_profiles', (table) => {
    table.uuid('consumer_suggestion_id').references('id').inTable('consumer_uhtd_suggestions').onDelete('SET NULL');
    table.string('uhtd_verification_status', 32).notNullable().defaultTo('linked');
  });

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_spa_profiles_consumer_suggestion_id
    ON spa_profiles (consumer_suggestion_id)
    WHERE consumer_suggestion_id IS NOT NULL
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS uq_spa_profiles_consumer_suggestion_id');
  await knex.schema.alterTable('spa_profiles', (table) => {
    table.dropColumn('consumer_suggestion_id');
    table.dropColumn('uhtd_verification_status');
  });
  await knex.schema.dropTableIfExists('consumer_uhtd_suggestions');
};
