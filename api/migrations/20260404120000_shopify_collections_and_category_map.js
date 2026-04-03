/**
 * Shopify collections cached per tenant, variant↔collection membership,
 * and retailer mapping from Shopify collection → PCdb category (UHTD).
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('pos_shopify_collections', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    /** Shopify Admin REST numeric collection id as string */
    table.string('shopify_collection_id', 64).notNullable();
    table.string('collection_type', 20).notNullable(); // 'custom' | 'smart'
    table.string('handle', 255);
    table.string('title', 500);
    table.timestamp('shopify_updated_at');
    table.jsonb('raw').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['tenant_id', 'shopify_collection_id']);
  });
  await knex.raw(
    'CREATE INDEX idx_pos_shopify_collections_tenant ON pos_shopify_collections(tenant_id)'
  );

  await knex.schema.createTable('pos_product_shopify_collections', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table
      .uuid('pos_product_id')
      .notNullable()
      .references('id')
      .inTable('pos_products')
      .onDelete('CASCADE');
    table.string('shopify_collection_id', 64).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['pos_product_id', 'shopify_collection_id']);
  });
  await knex.raw(
    'CREATE INDEX idx_pos_product_shopify_coll_tenant_coll ON pos_product_shopify_collections(tenant_id, shopify_collection_id)'
  );
  await knex.raw(
    'CREATE INDEX idx_pos_product_shopify_coll_pos_product ON pos_product_shopify_collections(pos_product_id)'
  );

  await knex.schema.createTable('tenant_collection_category_map', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('shopify_collection_id', 64).notNullable();
    table
      .uuid('pcdb_category_id')
      .notNullable()
      .references('id')
      .inTable('pcdb_categories')
      .onDelete('CASCADE');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['tenant_id', 'shopify_collection_id']);
  });
  await knex.raw(
    'CREATE INDEX idx_tenant_coll_cat_map_tenant ON tenant_collection_category_map(tenant_id)'
  );
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('tenant_collection_category_map');
  await knex.schema.dropTableIfExists('pos_product_shopify_collections');
  await knex.schema.dropTableIfExists('pos_shopify_collections');
};
