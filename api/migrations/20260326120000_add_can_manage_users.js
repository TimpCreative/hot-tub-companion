/**
 * Adds can_manage_users to admin_roles. Owners get it by default.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('admin_roles', (table) => {
    table.boolean('can_manage_users').defaultTo(false);
  });
  await knex('admin_roles').where({ role: 'owner' }).update({ can_manage_users: true });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('admin_roles', (table) => {
    table.dropColumn('can_manage_users');
  });
};
