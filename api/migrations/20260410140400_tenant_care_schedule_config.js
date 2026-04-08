exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.jsonb('care_schedule_config');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('care_schedule_config');
  });
};
