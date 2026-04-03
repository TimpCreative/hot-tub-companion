/**
 * Profile/legal fields and soft-delete on users.
 * Idempotent `up` so DBs that already applied this DDL under another filename (see 20260225110709 shim) stay safe.
 */
exports.up = async function up(knex) {
  const usersHasDeletedAt = await knex.schema.hasColumn('users', 'deleted_at');
  if (!usersHasDeletedAt) {
    await knex.schema.alterTable('users', (table) => {
      table.timestamp('deleted_at');
    });
  }
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_users_active ON users(tenant_id) WHERE deleted_at IS NULL'
  );

  const tenantsHasTerms = await knex.schema.hasColumn('tenants', 'terms_url');
  if (!tenantsHasTerms) {
    await knex.schema.alterTable('tenants', (table) => {
      table.text('terms_url');
    });
  }
  const tenantsHasPrivacy = await knex.schema.hasColumn('tenants', 'privacy_url');
  if (!tenantsHasPrivacy) {
    await knex.schema.alterTable('tenants', (table) => {
      table.text('privacy_url');
    });
  }
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
