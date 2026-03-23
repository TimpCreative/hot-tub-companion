/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.jsonb('onboarding_config').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('onboarding_config');
  });
};
