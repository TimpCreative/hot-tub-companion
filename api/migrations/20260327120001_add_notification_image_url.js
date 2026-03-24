exports.up = async function (knex) {
  await knex.schema.alterTable('scheduled_notifications', (table) => {
    table.text('image_url');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('scheduled_notifications', (table) => {
    table.dropColumn('image_url');
  });
};
