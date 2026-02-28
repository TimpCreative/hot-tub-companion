/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('scdb_spa_models', (table) => {
    table.boolean('has_jacuzzi_true').defaultTo(false);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('scdb_spa_models', (table) => {
    table.dropColumn('has_jacuzzi_true');
  });
};
