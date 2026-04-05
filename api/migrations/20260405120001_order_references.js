/**
 * Links Shopify orders to tenants (and matched app users) for idempotent webhook processing.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('order_references', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('shopify_order_id', 32).notNullable();
    table.integer('shopify_order_number').nullable();
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('customer_email', 320).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['tenant_id', 'shopify_order_id'], { indexName: 'uq_order_references_tenant_shopify_order' });
  });
  await knex.raw(
    'CREATE INDEX idx_order_references_tenant_created ON order_references(tenant_id, created_at DESC)'
  );
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('order_references');
};
