exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.jsonb('home_dashboard_config');
    table.string('public_contact_phone', 40);
    table.text('public_contact_address');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('home_dashboard_config');
    table.dropColumn('public_contact_phone');
    table.dropColumn('public_contact_address');
  });
};
