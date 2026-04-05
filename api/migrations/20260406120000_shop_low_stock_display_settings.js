/**
 * Retail-configurable shop stock messaging on product detail (mobile).
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.integer('shop_low_stock_threshold').notNullable().defaultTo(5);
    table.boolean('shop_show_in_stock_label').notNullable().defaultTo(true);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('shop_show_in_stock_label');
    table.dropColumn('shop_low_stock_threshold');
  });
};
