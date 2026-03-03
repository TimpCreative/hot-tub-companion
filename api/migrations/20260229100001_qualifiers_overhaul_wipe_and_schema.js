/**
 * Qualifiers Overhaul - Phase 1: Wipe test data, drop electrical configs, add sections and brand_qualifiers
 */

exports.up = async function (knex) {
  // 1. Wipe Test* entries (order respects FKs)
  const testComps = await knex('compatibility_groups').where('name', 'ilike', 'Test%').orWhere('id', 'ilike', 'Test%').select('id');
  const testCompIds = testComps.map((c) => c.id);
  if (testCompIds.length > 0) {
    await knex('comp_spas').whereIn('comp_id', testCompIds).del();
    await knex('compatibility_groups').whereIn('id', testCompIds).del();
  }

  const testBrands = await knex('scdb_brands').where('name', 'ilike', 'Test%').select('id');
  const testBrandIds = testBrands.map((b) => b.id);
  const testModelLines = testBrandIds.length > 0 ? await knex('scdb_model_lines').whereIn('brand_id', testBrandIds).select('id') : [];
  const testModelLineIds = testModelLines.map((ml) => ml.id);
  const testSpas = testModelLineIds.length > 0 ? await knex('scdb_spa_models').whereIn('model_line_id', testModelLineIds).select('id') : [];
  const testSpaIds = testSpas.map((s) => s.id);

  if (testSpaIds.length > 0) {
    await knex('part_spa_compatibility').whereIn('spa_model_id', testSpaIds).del();
    await knex('qdb_spa_qualifiers').whereIn('spa_model_id', testSpaIds).del();
    const hasElectrical = await knex.schema.hasTable('scdb_spa_electrical_configs');
    if (hasElectrical) {
      await knex('scdb_spa_electrical_configs').whereIn('spa_model_id', testSpaIds).del();
    }
    await knex('comp_spas').whereIn('spa_model_id', testSpaIds).del();
    await knex('scdb_spa_models').whereIn('id', testSpaIds).del();
  }
  if (testModelLineIds.length > 0) {
    await knex('scdb_model_lines').whereIn('id', testModelLineIds).del();
  }
  if (testBrandIds.length > 0) {
    await knex('scdb_brands').whereIn('id', testBrandIds).del();
  }

  const testParts = await knex('pcdb_parts').where('name', 'ilike', 'Test%').select('id');
  const testPartIds = testParts.map((p) => p.id);
  if (testPartIds.length > 0) {
    await knex('part_spa_compatibility').whereIn('part_id', testPartIds).del();
    await knex('qdb_part_qualifiers').whereIn('part_id', testPartIds).del();
    await knex('pcdb_parts').whereIn('id', testPartIds).del();
  }

  // 2. Drop electrical configs table
  await knex.schema.dropTableIfExists('scdb_spa_electrical_configs');

  // 3. Drop spa sanitization and legacy electrical columns
  await knex.schema.alterTable('scdb_spa_models', (table) => {
    table.dropColumn('has_ozone');
    table.dropColumn('has_uv');
    table.dropColumn('has_salt_system');
    table.dropColumn('has_jacuzzi_true');
    table.dropColumn('electrical_requirement');
  });

  // 4. Create qdb_sections
  await knex.schema.createTable('qdb_sections', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 5. Create brand_qualifiers
  await knex.schema.createTable('brand_qualifiers', (table) => {
    table.uuid('brand_id').notNullable().references('id').inTable('scdb_brands').onDelete('CASCADE');
    table.uuid('qualifier_id').notNullable().references('id').inTable('qdb_qualifiers').onDelete('CASCADE');
    table.primary(['brand_id', 'qualifier_id']);
  });
  await knex.raw('CREATE INDEX idx_brand_qualifiers_brand ON brand_qualifiers(brand_id)');

  // 6. Alter qdb_qualifiers - add new columns
  await knex.schema.alterTable('qdb_qualifiers', (table) => {
    table.uuid('section_id').references('id').inTable('qdb_sections').onDelete('SET NULL');
    table.boolean('is_universal').defaultTo(false);
    table.boolean('is_required').defaultTo(false);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('qdb_qualifiers', (table) => {
    table.dropColumn('section_id');
    table.dropColumn('is_universal');
    table.dropColumn('is_required');
  });
  await knex.schema.dropTableIfExists('brand_qualifiers');
  await knex.schema.dropTableIfExists('qdb_sections');

  await knex.schema.alterTable('scdb_spa_models', (table) => {
    table.boolean('has_ozone').defaultTo(false);
    table.boolean('has_uv').defaultTo(false);
    table.boolean('has_salt_system').defaultTo(false);
    table.boolean('has_jacuzzi_true').defaultTo(false);
    table.string('electrical_requirement', 50);
  });

  await knex.schema.createTable('scdb_spa_electrical_configs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('spa_model_id').notNullable().references('id').inTable('scdb_spa_models').onDelete('CASCADE');
    table.integer('voltage').notNullable();
    table.string('voltage_unit', 10).defaultTo('VAC');
    table.integer('frequency_hz');
    table.string('amperage', 50).notNullable();
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index('spa_model_id', 'idx_electrical_spa_model');
  });
};
