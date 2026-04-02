exports.up = async function (knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.string('shopify_client_id', 255);
    table.text('shopify_client_secret');
  });

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_tenants_shopify_store_url_lower
    ON tenants (LOWER(shopify_store_url))
    WHERE shopify_store_url IS NOT NULL
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_tenants_shopify_store_url_lower');
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('shopify_client_secret');
    table.dropColumn('shopify_client_id');
  });
};

