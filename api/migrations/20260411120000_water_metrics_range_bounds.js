/**
 * Add allowed value range (scale min/max) for water_metrics.
 * Default ideal min/max must sit inside [range_min, range_max].
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('water_metrics', (table) => {
    table.decimal('range_min', 10, 2).notNullable().defaultTo(0);
    table.decimal('range_max', 10, 2).notNullable().defaultTo(10000);
  });

  await knex('water_metrics').update({
    range_min: knex.ref('default_min_value'),
    range_max: knex.ref('default_max_value'),
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('water_metrics', (table) => {
    table.dropColumn('range_min');
    table.dropColumn('range_max');
  });
};
