/**
 * Add link_type, link_id, image_url to global_push_announcements
 * for deep links and rich notifications.
 */

exports.up = async function (knex) {
  await knex.schema.table('global_push_announcements', (table) => {
    table.string('link_type', 30);
    table.string('link_id', 255);
    table.text('image_url');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('global_push_announcements', (table) => {
    table.dropColumn('link_type');
    table.dropColumn('link_id');
    table.dropColumn('image_url');
  });
};
