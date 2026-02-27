/**
 * UHTD Migration 005: Qdb Tables
 * Qualifier Database - additional attributes that affect compatibility
 * 
 * Examples: sanitization system, voltage requirement, ozone/UV/salt compatibility
 */

exports.up = async function (knex) {
  // qdb_qualifiers - Qualifier definitions
  await knex.schema.createTable('qdb_qualifiers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable().unique();
    table.string('display_name', 100).notNullable();
    table.string('data_type', 20).notNullable(); // 'enum', 'boolean', 'number', 'text'
    table.jsonb('allowed_values'); // For enums: ["bromine", "chlorine", ...]
    table.string('applies_to', 20).notNullable(); // 'spa', 'part', 'both'
    table.text('description');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // qdb_spa_qualifiers - Qualifier values for spa model-year records
  await knex.schema.createTable('qdb_spa_qualifiers', (table) => {
    table.uuid('spa_model_id').notNullable().references('id').inTable('scdb_spa_models').onDelete('CASCADE');
    table.uuid('qualifier_id').notNullable().references('id').inTable('qdb_qualifiers').onDelete('CASCADE');
    table.jsonb('value').notNullable();
    table.primary(['spa_model_id', 'qualifier_id']);
  });
  await knex.raw('CREATE INDEX idx_qdb_spa_qualifiers_spa ON qdb_spa_qualifiers(spa_model_id)');

  // qdb_part_qualifiers - Qualifier requirements on parts
  await knex.schema.createTable('qdb_part_qualifiers', (table) => {
    table.uuid('part_id').notNullable().references('id').inTable('pcdb_parts').onDelete('CASCADE');
    table.uuid('qualifier_id').notNullable().references('id').inTable('qdb_qualifiers').onDelete('CASCADE');
    table.jsonb('value').notNullable();
    table.boolean('is_required').defaultTo(false); // If true, part REQUIRES spa to match
    table.primary(['part_id', 'qualifier_id']);
  });
  await knex.raw('CREATE INDEX idx_qdb_part_qualifiers_part ON qdb_part_qualifiers(part_id)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('qdb_part_qualifiers');
  await knex.schema.dropTableIfExists('qdb_spa_qualifiers');
  await knex.schema.dropTableIfExists('qdb_qualifiers');
};
