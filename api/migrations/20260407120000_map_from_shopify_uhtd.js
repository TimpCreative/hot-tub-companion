/**
 * Map from Shopify (UHTD): reject columns, listing snapshot / reverify, review queue, mapping actor email.
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('pos_products', (table) => {
    table.timestamp('uhtd_import_rejected_at', { useTz: true });
    table.string('uhtd_import_reject_reason_code', 64);
    table.text('uhtd_import_reject_note');
    table.string('uhtd_import_rejected_by', 255);
    table.jsonb('shopify_listing_snapshot');
    table.timestamp('uhtd_import_needs_reverify_at', { useTz: true });
    table.string('mapping_actor_email', 255);
  });

  await knex.schema.createTable('uhtd_shopify_import_review_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('pos_product_id').notNullable().references('id').inTable('pos_products').onDelete('CASCADE');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('status', 20).notNullable().defaultTo('open'); // open | approved | dismissed
    table.jsonb('draft_payload').notNullable().defaultTo('{}');
    table.text('source_super_admin_email');
    table.uuid('resolved_part_id').references('id').inTable('pcdb_parts').onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('resolved_at', { useTz: true });
  });

  await knex.raw(`
    CREATE UNIQUE INDEX uhtd_shopify_import_review_open_pos_product
    ON uhtd_shopify_import_review_items (pos_product_id)
    WHERE status = 'open'
  `);
  await knex.raw(
    'CREATE INDEX idx_uhtd_shopify_import_review_tenant_status ON uhtd_shopify_import_review_items(tenant_id, status)'
  );
  await knex.raw(
    'CREATE INDEX idx_pos_products_uhtd_import_rejected ON pos_products(tenant_id) WHERE uhtd_import_rejected_at IS NULL'
  );
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS uhtd_shopify_import_review_open_pos_product');
  await knex.raw('DROP INDEX IF EXISTS idx_uhtd_shopify_import_review_tenant_status');
  await knex.raw('DROP INDEX IF EXISTS idx_pos_products_uhtd_import_rejected');
  await knex.schema.dropTableIfExists('uhtd_shopify_import_review_items');
  await knex.schema.alterTable('pos_products', (table) => {
    table.dropColumn('uhtd_import_rejected_at');
    table.dropColumn('uhtd_import_reject_reason_code');
    table.dropColumn('uhtd_import_reject_note');
    table.dropColumn('uhtd_import_rejected_by');
    table.dropColumn('shopify_listing_snapshot');
    table.dropColumn('uhtd_import_needs_reverify_at');
    table.dropColumn('mapping_actor_email');
  });
};
