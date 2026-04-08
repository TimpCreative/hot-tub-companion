exports.up = async function up(knex) {
  await knex.schema.createTable('user_water_care_consents', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('policy_version', 120).notNullable();
    table.timestamp('accepted_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('spa_profile_id').nullable().references('id').inTable('spa_profiles').onDelete('SET NULL');
    table.unique(['user_id', 'tenant_id', 'policy_version']);
  });
  await knex.schema.raw(
    'CREATE INDEX idx_water_care_consents_user_tenant ON user_water_care_consents (user_id, tenant_id)'
  );
};

exports.down = async function down(knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_water_care_consents_user_tenant');
  await knex.schema.dropTableIfExists('user_water_care_consents');
};
