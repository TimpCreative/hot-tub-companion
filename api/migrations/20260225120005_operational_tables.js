/**
 * UHTD Migration 006: Operational Tables
 * audit_log, correction_requests, pos_products
 */

exports.up = async function (knex) {
  // audit_log - Change history for all UHTD modifications
  await knex.schema.createTable('audit_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('table_name', 100).notNullable();
    table.string('record_id', 255).notNullable(); // UUID or VARCHAR for Comps
    table.string('action', 20).notNullable(); // 'INSERT', 'UPDATE', 'DELETE'
    table.jsonb('old_values');
    table.jsonb('new_values');
    table.uuid('changed_by');
    table.timestamp('changed_at').defaultTo(knex.fn.now());
    table.text('change_reason');
  });
  await knex.raw('CREATE INDEX idx_audit_log_table ON audit_log(table_name, changed_at DESC)');
  await knex.raw('CREATE INDEX idx_audit_log_record ON audit_log(table_name, record_id)');
  await knex.raw('CREATE INDEX idx_audit_log_user ON audit_log(changed_by, changed_at DESC)');

  // correction_requests - Tenant-submitted data correction requests
  await knex.schema.createTable('correction_requests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('request_type', 50).notNullable(); // 'missing_model', 'wrong_specs', 'wrong_compatibility', 'missing_part', 'other'
    table.text('description').notNullable();
    table.text('source_reference'); // Optional URL or document reference
    table.string('affected_entity_type', 50); // 'brand', 'model', 'part', 'comp'
    table.string('affected_entity_id', 255);
    
    // Resolution
    table.string('status', 20).defaultTo('pending'); // 'pending', 'in_review', 'resolved', 'rejected'
    table.text('resolution_notes');
    table.uuid('resolved_by');
    table.timestamp('resolved_at');
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX idx_correction_requests_tenant ON correction_requests(tenant_id)');
  await knex.raw('CREATE INDEX idx_correction_requests_status ON correction_requests(status)');

  // pos_products - Tenant product catalog from POS (one row per variant)
  await knex.schema.createTable('pos_products', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('pos_product_id', 255).notNullable();
    table.string('pos_variant_id', 255); // Each variant = separate row
    
    // Product data from POS
    table.string('title', 500).notNullable();
    table.text('description');
    table.string('vendor', 255);
    table.string('product_type', 255);
    table.specificType('tags', 'TEXT[]');
    table.integer('price').notNullable(); // Cents (no UHTD pricing!)
    table.integer('compare_at_price');
    table.string('sku', 255);
    table.string('barcode', 50); // UPC for auto-mapping
    table.jsonb('images').defaultTo('[]');
    table.jsonb('variants').defaultTo('[]');
    table.integer('inventory_quantity').defaultTo(0);
    table.decimal('weight', 10, 2);
    table.string('weight_unit', 10);
    
    // Visibility
    table.boolean('is_hidden').defaultTo(false);
    table.timestamp('hidden_at');
    table.uuid('hidden_by');
    
    // UHTD Mapping
    table.uuid('uhtd_part_id').references('id').inTable('pcdb_parts').onDelete('SET NULL');
    table.string('mapping_status', 20).defaultTo('unmapped'); // 'unmapped', 'auto_suggested', 'confirmed'
    table.decimal('mapping_confidence', 3, 2);
    table.uuid('mapped_by');
    table.timestamp('mapped_at');
    
    // Sync metadata
    table.string('pos_status', 20);
    table.timestamp('pos_updated_at');
    table.timestamp('last_synced_at').defaultTo(knex.fn.now());
    table.string('sync_hash', 64);
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.unique(['tenant_id', 'pos_product_id', 'pos_variant_id']);
  });
  await knex.raw('CREATE INDEX idx_pos_products_tenant ON pos_products(tenant_id)');
  await knex.raw('CREATE INDEX idx_pos_products_uhtd ON pos_products(uhtd_part_id)');
  await knex.raw('CREATE INDEX idx_pos_products_mapping ON pos_products(tenant_id, mapping_status)');
  await knex.raw('CREATE INDEX idx_pos_products_barcode ON pos_products(barcode) WHERE barcode IS NOT NULL');
  await knex.raw('CREATE INDEX idx_pos_products_sku ON pos_products(sku) WHERE sku IS NOT NULL');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('pos_products');
  await knex.schema.dropTableIfExists('correction_requests');
  await knex.schema.dropTableIfExists('audit_log');
};
