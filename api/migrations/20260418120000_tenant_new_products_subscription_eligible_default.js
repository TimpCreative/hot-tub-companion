/**
 * Default subscription eligibility for newly synced catalog rows (Shopify → pos_products).
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.boolean('new_products_subscription_eligible_by_default').notNullable().defaultTo(true);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('new_products_subscription_eligible_by_default');
  });
};
