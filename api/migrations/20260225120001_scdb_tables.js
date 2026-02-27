/**
 * UHTD Migration 002: SCdb Tables
 * Spa Configuration Database - brands, model lines, spa models
 * 
 * Key design decisions:
 * - Individual year rows (not year ranges)
 * - Soft deletes via deleted_at column
 * - Data provenance via data_source column
 */

exports.up = async function (knex) {
  // scdb_brands - Spa manufacturers
  await knex.schema.createTable('scdb_brands', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable().unique();
    table.text('logo_url');
    table.text('website_url');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('deleted_at');
    table.string('data_source', 100);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX idx_scdb_brands_name ON scdb_brands(name)');
  await knex.raw('CREATE INDEX idx_scdb_brands_active ON scdb_brands(is_active) WHERE deleted_at IS NULL');

  // scdb_model_lines - Product families within a brand
  await knex.schema.createTable('scdb_model_lines', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('brand_id').notNullable().references('id').inTable('scdb_brands').onDelete('CASCADE');
    table.string('name', 150).notNullable();
    table.text('description');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('deleted_at');
    table.string('data_source', 100);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['brand_id', 'name']);
  });
  await knex.raw('CREATE INDEX idx_scdb_model_lines_brand ON scdb_model_lines(brand_id)');

  // scdb_spa_models - Individual model-year records (atomic unit of compatibility)
  await knex.schema.createTable('scdb_spa_models', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('model_line_id').notNullable().references('id').inTable('scdb_model_lines').onDelete('CASCADE');
    table.uuid('brand_id').notNullable().references('id').inTable('scdb_brands').onDelete('CASCADE');
    table.string('name', 150).notNullable();
    table.integer('year').notNullable(); // Individual year (2019, 2020, etc.)
    table.string('manufacturer_sku', 100);
    
    // Specifications
    table.integer('water_capacity_gallons');
    table.integer('jet_count');
    table.integer('seating_capacity');
    table.integer('dimensions_length_inches');
    table.integer('dimensions_width_inches');
    table.integer('dimensions_height_inches');
    table.integer('weight_dry_lbs');
    table.integer('weight_filled_lbs');
    table.string('electrical_requirement', 50);
    
    // Features
    table.boolean('has_ozone').defaultTo(false);
    table.boolean('has_uv').defaultTo(false);
    table.boolean('has_salt_system').defaultTo(false);
    
    // Media
    table.text('image_url');
    table.text('spec_sheet_url');
    
    // Status
    table.boolean('is_discontinued').defaultTo(false);
    table.text('notes');
    table.string('data_source', 100);
    table.timestamp('deleted_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.unique(['model_line_id', 'name', 'year']);
  });
  await knex.raw('CREATE INDEX idx_scdb_models_model_line ON scdb_spa_models(model_line_id)');
  await knex.raw('CREATE INDEX idx_scdb_models_brand ON scdb_spa_models(brand_id)');
  await knex.raw('CREATE INDEX idx_scdb_models_name ON scdb_spa_models(name)');
  await knex.raw('CREATE INDEX idx_scdb_models_year ON scdb_spa_models(year)');
  await knex.raw('CREATE INDEX idx_scdb_models_active ON scdb_spa_models(brand_id, year) WHERE deleted_at IS NULL');
  await knex.raw("CREATE INDEX idx_scdb_models_name_trgm ON scdb_spa_models USING gin(name gin_trgm_ops)");

  // tenant_brand_visibility - Controls which brands appear in tenant's app
  await knex.schema.createTable('tenant_brand_visibility', (table) => {
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('brand_id').notNullable().references('id').inTable('scdb_brands').onDelete('CASCADE');
    table.boolean('is_visible').defaultTo(true);
    table.primary(['tenant_id', 'brand_id']);
  });

  // Add foreign key to spa_profiles for UHTD link
  await knex.schema.raw(`
    ALTER TABLE spa_profiles 
    ADD CONSTRAINT fk_spa_profiles_uhtd_model 
    FOREIGN KEY (uhtd_spa_model_id) 
    REFERENCES scdb_spa_models(id) 
    ON DELETE SET NULL
  `);
};

exports.down = async function (knex) {
  await knex.schema.raw('ALTER TABLE spa_profiles DROP CONSTRAINT IF EXISTS fk_spa_profiles_uhtd_model');
  await knex.schema.dropTableIfExists('tenant_brand_visibility');
  await knex.schema.dropTableIfExists('scdb_spa_models');
  await knex.schema.dropTableIfExists('scdb_model_lines');
  await knex.schema.dropTableIfExists('scdb_brands');
};
