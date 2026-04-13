/**
 * Persist effective savings percent for subscription bundles.
 * Used by admin UI + app copy (e.g. "Save X% with this bundle").
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('subscription_bundle_definitions', (table) => {
    table.decimal('bundle_savings_percent', 5, 2).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('subscription_bundle_definitions', (table) => {
    table.dropColumn('bundle_savings_percent');
  });
};

