/**
 * Tenant default bundle discount % and per-bundle optional override.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.decimal('subscription_bundle_default_discount_percent', 5, 2).notNullable().defaultTo(0);
  });
  await knex.schema.alterTable('subscription_bundle_definitions', (table) => {
    table.decimal('bundle_discount_percent', 5, 2).nullable();
    table.integer('bundle_recurring_unit_amount_cents').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('subscription_bundle_definitions', (table) => {
    table.dropColumn('bundle_recurring_unit_amount_cents');
    table.dropColumn('bundle_discount_percent');
  });
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('subscription_bundle_default_discount_percent');
  });
};
