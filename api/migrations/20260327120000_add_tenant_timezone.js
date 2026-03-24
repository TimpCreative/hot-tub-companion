exports.up = async function (knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.string('timezone', 64).defaultTo('America/Denver');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('timezone');
  });
};
