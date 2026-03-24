/**
 * Sets can_send_notifications default to true for admin_roles.
 * Existing admins are updated; new admins get true by default.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex('admin_roles').update({ can_send_notifications: true });
  await knex.raw(
    'ALTER TABLE admin_roles ALTER COLUMN can_send_notifications SET DEFAULT true'
  );
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw(
    'ALTER TABLE admin_roles ALTER COLUMN can_send_notifications SET DEFAULT false'
  );
};
