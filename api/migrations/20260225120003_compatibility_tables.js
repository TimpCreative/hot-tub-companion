/**
 * UHTD Migration 004: Compatibility Tables
 * part_spa_compatibility (SOURCE OF TRUTH), compatibility_groups (Comps), comp_spas
 * 
 * Key design decisions:
 * - part_spa_compatibility is THE source of truth for all compatibility
 * - Comps use human-readable VARCHAR(50) IDs (not UUID) for bulk import UX
 * - No comp_parts table - part membership is computed dynamically
 * - pending/confirmed workflow for data quality
 */

exports.up = async function (knex) {
  // part_spa_compatibility - THE SOURCE OF TRUTH
  await knex.schema.createTable('part_spa_compatibility', (table) => {
    table.uuid('part_id').notNullable().references('id').inTable('pcdb_parts').onDelete('CASCADE');
    table.uuid('spa_model_id').notNullable().references('id').inTable('scdb_spa_models').onDelete('CASCADE');
    table.string('status', 20).defaultTo('pending'); // 'pending', 'confirmed', 'rejected'
    
    // Compatibility details
    table.text('fit_notes'); // 'requires adapter bracket', 'only 2-inch plumbing'
    table.integer('quantity_required').defaultTo(1); // How many the spa needs
    table.string('position', 100); // 'primary pump', 'top filter', etc.
    
    // Provenance
    table.string('source', 50); // 'manual', 'comp_assignment', 'bulk_import', 'auto_detected'
    table.uuid('added_by');
    table.timestamp('added_at').defaultTo(knex.fn.now());
    table.uuid('reviewed_by');
    table.timestamp('reviewed_at');
    
    table.primary(['part_id', 'spa_model_id']);
  });
  await knex.raw('CREATE INDEX idx_part_spa_compat_part ON part_spa_compatibility(part_id)');
  await knex.raw('CREATE INDEX idx_part_spa_compat_spa ON part_spa_compatibility(spa_model_id)');
  await knex.raw('CREATE INDEX idx_part_spa_compat_status ON part_spa_compatibility(status)');
  await knex.raw("CREATE INDEX idx_part_spa_compat_confirmed ON part_spa_compatibility(part_id, spa_model_id) WHERE status = 'confirmed'");

  // compatibility_groups - Named spa groupings (Comps)
  await knex.schema.createTable('compatibility_groups', (table) => {
    table.string('id', 50).primary(); // Human-readable: COMP-JAC-FILT-001
    table.string('name', 255);
    table.text('description');
    table.boolean('auto_generated').defaultTo(false);
    table.uuid('source_category_id').references('id').inTable('pcdb_categories').onDelete('SET NULL');
    table.uuid('created_by');
    table.timestamp('deleted_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX idx_comps_auto ON compatibility_groups(auto_generated)');
  await knex.raw('CREATE INDEX idx_comps_active ON compatibility_groups(id) WHERE deleted_at IS NULL');
  await knex.raw("CREATE INDEX idx_comps_name_trgm ON compatibility_groups USING gin(name gin_trgm_ops) WHERE name IS NOT NULL");

  // comp_spas - Spa membership in Comps
  await knex.schema.createTable('comp_spas', (table) => {
    table.string('comp_id', 50).notNullable().references('id').inTable('compatibility_groups').onDelete('CASCADE');
    table.uuid('spa_model_id').notNullable().references('id').inTable('scdb_spa_models').onDelete('CASCADE');
    table.timestamp('added_at').defaultTo(knex.fn.now());
    table.primary(['comp_id', 'spa_model_id']);
  });
  await knex.raw('CREATE INDEX idx_comp_spas_comp ON comp_spas(comp_id)');
  await knex.raw('CREATE INDEX idx_comp_spas_spa ON comp_spas(spa_model_id)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('comp_spas');
  await knex.schema.dropTableIfExists('compatibility_groups');
  await knex.schema.dropTableIfExists('part_spa_compatibility');
};
