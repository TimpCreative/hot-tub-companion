/**
 * Optional mobile tab visibility (default true = show tab).
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.boolean('feature_tab_inbox').notNullable().defaultTo(true);
    table.boolean('feature_tab_dealer').notNullable().defaultTo(true);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('feature_tab_inbox');
    table.dropColumn('feature_tab_dealer');
  });
};
