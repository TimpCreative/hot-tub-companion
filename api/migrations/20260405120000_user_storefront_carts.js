/**
 * Persists Shopify Storefront cart id per tenant user (server-side session for cart proxy).
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('user_storefront_carts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('storefront_cart_id', 128).notNullable();
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['tenant_id', 'user_id'], { indexName: 'uq_user_storefront_carts_tenant_user' });
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('user_storefront_carts');
};
