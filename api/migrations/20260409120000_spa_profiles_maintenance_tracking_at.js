/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('spa_profiles', (table) => {
    table.timestamp('last_drain_refill_at').nullable();
    table.timestamp('last_cover_check_at').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('spa_profiles', (table) => {
    table.dropColumn('last_drain_refill_at');
    table.dropColumn('last_cover_check_at');
  });
};
