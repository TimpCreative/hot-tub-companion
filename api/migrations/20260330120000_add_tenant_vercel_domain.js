exports.up = async function (knex) {
  await knex.schema.table('tenants', (table) => {
    table.string('dashboard_domain', 255);
    table.string('vercel_domain_status', 30);
    table.text('vercel_domain_error');
    table.timestamp('vercel_domain_updated_at');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('tenants', (table) => {
    table.dropColumn('dashboard_domain');
    table.dropColumn('vercel_domain_status');
    table.dropColumn('vercel_domain_error');
    table.dropColumn('vercel_domain_updated_at');
  });
};
