exports.up = async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.timestamp('deleted_at');
  });
  await knex.schema.raw('CREATE INDEX idx_users_active ON users(tenant_id) WHERE deleted_at IS NULL');

  await knex.schema.alterTable('tenants', (table) => {
    table.text('terms_url');
    table.text('privacy_url');
  });
};

exports.down = async function down(knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_users_active');
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('deleted_at');
  });

  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('terms_url');
    table.dropColumn('privacy_url');
  });
};
