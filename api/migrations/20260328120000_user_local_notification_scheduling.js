exports.up = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('timezone', 64);
  });

  await knex.schema.alterTable('scheduled_notifications', (table) => {
    table.string('schedule_mode', 20).defaultTo('retailer_time');
    table.string('send_at_time', 5);
    table.string('past_timezone_handling', 20).defaultTo('send_immediately');
  });

  await knex.schema.alterTable('notification_log', (table) => {
    table.uuid('scheduled_notification_id').references('id').inTable('scheduled_notifications').onDelete('SET NULL');
  });
  await knex.schema.raw('CREATE INDEX idx_notification_log_scheduled ON notification_log(scheduled_notification_id)');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_notification_log_scheduled').catch(() => {});
  await knex.schema.alterTable('notification_log', (table) => {
    table.dropColumn('scheduled_notification_id');
  });
  await knex.schema.alterTable('scheduled_notifications', (table) => {
    table.dropColumn('schedule_mode');
    table.dropColumn('send_at_time');
    table.dropColumn('past_timezone_handling');
  });
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('timezone');
  });
};
