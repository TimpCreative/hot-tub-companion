exports.up = async function (knex) {
  await knex.schema.table('users', (table) => {
    table.string('fcm_token_provider', 30);
    table.string('fcm_token_status', 30).defaultTo('missing');
    table.text('fcm_token_error');
    table.timestamp('fcm_token_last_validated_at');
  });
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_users_tenant_fcm_status ON users(tenant_id, fcm_token_status)');
};

exports.down = async function (knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_users_tenant_fcm_status');
  await knex.schema.table('users', (table) => {
    table.dropColumn('fcm_token_provider');
    table.dropColumn('fcm_token_status');
    table.dropColumn('fcm_token_error');
    table.dropColumn('fcm_token_last_validated_at');
  });
};
