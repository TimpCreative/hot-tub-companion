/**
 * Creates platform_users table for super/tenant admins (DB-backed, replaces env-only).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('platform_users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('email', 255).notNullable();
    table.string('platform_role', 20).notNullable(); // 'super_admin' | 'tenant_admin'
    table.jsonb('tenant_scope'); // NULL = all tenants; ["uuid1","uuid2"] for scoped
    table.string('added_by', 255);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE UNIQUE INDEX idx_platform_users_email_lower ON platform_users (LOWER(email))');
  await knex.raw('CREATE INDEX idx_platform_users_role ON platform_users (platform_role)');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('platform_users');
};
