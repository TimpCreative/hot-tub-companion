exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.text('public_contact_email');
    table.text('public_contact_hours');
    table.jsonb('dealer_page_config');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('dealer_page_config');
    table.dropColumn('public_contact_hours');
    table.dropColumn('public_contact_email');
  });
};
