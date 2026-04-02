/**
 * Shopify catalog auto-sync: tenant flags, inventory item id on pos_products,
 * webhook idempotency receipts, stored Shopify webhook subscription ids.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.boolean('shopify_catalog_sync_enabled').notNullable().defaultTo(false);
    table.timestamp('last_cron_product_sync_at');
    table.jsonb('shopify_webhook_subscription_ids').nullable();
  });

  await knex.schema.alterTable('pos_products', (table) => {
    table.string('shopify_inventory_item_id', 64).nullable().index();
  });

  await knex.schema.createTable('shopify_webhook_receipts', (table) => {
    table.string('webhook_id', 128).primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('topic', 128).notNullable();
    table.timestamp('received_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(
    'CREATE INDEX idx_shopify_webhook_receipts_tenant_received ON shopify_webhook_receipts(tenant_id, received_at)'
  );
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('shopify_webhook_receipts');
  await knex.schema.alterTable('pos_products', (table) => {
    table.dropIndex(['shopify_inventory_item_id']);
    table.dropColumn('shopify_inventory_item_id');
  });
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('shopify_webhook_subscription_ids');
    table.dropColumn('last_cron_product_sync_at');
    table.dropColumn('shopify_catalog_sync_enabled');
  });
};
