/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('scdb_spa_electrical_configs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('spa_model_id').notNullable().references('id').inTable('scdb_spa_models').onDelete('CASCADE');
    table.integer('voltage').notNullable();
    table.string('voltage_unit', 10).defaultTo('VAC');
    table.integer('frequency_hz');
    table.string('amperage', 50).notNullable();
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index('spa_model_id', 'idx_electrical_spa_model');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('scdb_spa_electrical_configs');
};
