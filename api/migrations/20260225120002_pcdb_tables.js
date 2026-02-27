/**
 * UHTD Migration 003: PCdb Tables
 * Parts Catalog Database - categories, interchange groups, parts
 * 
 * Key design decisions:
 * - Every manufacturer variant gets its own row (no deduplication)
 * - UPC, EAN, sku_aliases for high-confidence auto-mapping
 * - display_importance for sort ordering in customer-facing views
 */

exports.up = async function (knex) {
  // pcdb_categories - Part categories
  await knex.schema.createTable('pcdb_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable().unique();
    table.string('display_name', 100).notNullable();
    table.text('description');
    table.string('icon_name', 50);
    table.integer('sort_order').defaultTo(0);
    table.timestamp('deleted_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // pcdb_interchange_groups - Groups of equivalent/interchangeable parts
  await knex.schema.createTable('pcdb_interchange_groups', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255);
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // pcdb_parts - Individual parts
  await knex.schema.createTable('pcdb_parts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('category_id').notNullable().references('id').inTable('pcdb_categories').onDelete('RESTRICT');
    
    // Identification (for POS auto-mapping)
    table.string('part_number', 100);
    table.string('upc', 20); // Universal Product Code - primary mapping signal
    table.string('ean', 20); // European Article Number
    table.specificType('sku_aliases', 'TEXT[]'); // Alternate SKU formats
    table.string('name', 255).notNullable();
    table.string('manufacturer', 100);
    
    // Classification
    table.uuid('interchange_group_id').references('id').inTable('pcdb_interchange_groups').onDelete('SET NULL');
    table.boolean('is_oem').defaultTo(false);
    table.boolean('is_universal').defaultTo(false); // Fits all spas, skip compatibility check
    table.boolean('is_discontinued').defaultTo(false);
    table.timestamp('discontinued_at');
    table.integer('display_importance').defaultTo(2); // 1=OEM/premium, 2=standard, 3=third-party
    
    // Physical attributes
    table.jsonb('dimensions_json');
    
    // Media
    table.text('image_url');
    table.text('spec_sheet_url');
    
    // Metadata
    table.text('notes');
    table.string('data_source', 100);
    table.timestamp('deleted_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_pcdb_parts_category ON pcdb_parts(category_id)');
  await knex.raw('CREATE INDEX idx_pcdb_parts_number ON pcdb_parts(part_number)');
  await knex.raw('CREATE INDEX idx_pcdb_parts_upc ON pcdb_parts(upc) WHERE upc IS NOT NULL');
  await knex.raw('CREATE INDEX idx_pcdb_parts_ean ON pcdb_parts(ean) WHERE ean IS NOT NULL');
  await knex.raw('CREATE INDEX idx_pcdb_parts_manufacturer ON pcdb_parts(manufacturer)');
  await knex.raw('CREATE INDEX idx_pcdb_parts_interchange ON pcdb_parts(interchange_group_id) WHERE interchange_group_id IS NOT NULL');
  await knex.raw("CREATE INDEX idx_pcdb_parts_name ON pcdb_parts USING gin(to_tsvector('english', name))");
  await knex.raw("CREATE INDEX idx_pcdb_parts_name_trgm ON pcdb_parts USING gin(name gin_trgm_ops)");
  await knex.raw("CREATE INDEX idx_pcdb_parts_number_trgm ON pcdb_parts USING gin(part_number gin_trgm_ops) WHERE part_number IS NOT NULL");
  await knex.raw('CREATE INDEX idx_pcdb_parts_sku_aliases ON pcdb_parts USING gin(sku_aliases) WHERE sku_aliases IS NOT NULL');
  await knex.raw('CREATE INDEX idx_pcdb_parts_active ON pcdb_parts(category_id) WHERE deleted_at IS NULL');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('pcdb_parts');
  await knex.schema.dropTableIfExists('pcdb_interchange_groups');
  await knex.schema.dropTableIfExists('pcdb_categories');
};
