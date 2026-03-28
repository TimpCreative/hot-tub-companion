/**
 * Commercial plan label for presets + Super Admin overrides.
 * Effective feature gates remain on feature_* columns (see SAAS-PLANS-AND-FEATURES.md).
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.string('saas_plan', 20).notNullable().defaultTo('base');
  });
  // Pilot tenant: Advanced preset + referrals on (see SAAS-PLANS-AND-FEATURES.md)
  await knex('tenants').where({ slug: 'takeabreak' }).update({
    saas_plan: 'advanced',
    feature_referrals: true,
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('saas_plan');
  });
};
