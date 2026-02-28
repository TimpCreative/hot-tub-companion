/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('pcdb_categories', (table) => {
    table.uuid('parent_id').references('id').inTable('pcdb_categories').onDelete('SET NULL');
    table.text('full_path');
    table.integer('depth').defaultTo(0);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('pcdb_categories', (table) => {
    table.dropColumn('parent_id');
    table.dropColumn('full_path');
    table.dropColumn('depth');
  });
};
