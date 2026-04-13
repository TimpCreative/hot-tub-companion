/**
 * Retailer-driven subscription catalog: per-product single offers, bundle Stripe product id, is_kit, nullable bundle price for migration flows.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('pos_products', (table) => {
    table.boolean('subscription_eligible').notNullable().defaultTo(false);
    table.string('subscription_stripe_product_id', 64).nullable();
    table.string('subscription_stripe_price_id', 120).nullable();
    table.integer('subscription_unit_amount_cents').nullable();
    table.string('subscription_currency', 8).nullable();
    table.string('subscription_interval', 16).nullable();
  });

  await knex.schema.alterTable('subscription_bundle_definitions', (table) => {
    table.string('stripe_product_id', 64).nullable();
    table.boolean('is_kit').notNullable().defaultTo(true);
  });

  await knex.raw(
    'ALTER TABLE subscription_bundle_definitions ALTER COLUMN stripe_price_id DROP NOT NULL'
  );
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('subscription_bundle_definitions', (table) => {
    table.dropColumn('stripe_product_id');
    table.dropColumn('is_kit');
  });
  // stripe_price_id may remain nullable after rollback if rows had NULL (cannot safely SET NOT NULL).

  await knex.schema.alterTable('pos_products', (table) => {
    table.dropColumn('subscription_eligible');
    table.dropColumn('subscription_stripe_product_id');
    table.dropColumn('subscription_stripe_price_id');
    table.dropColumn('subscription_unit_amount_cents');
    table.dropColumn('subscription_currency');
    table.dropColumn('subscription_interval');
  });
};
