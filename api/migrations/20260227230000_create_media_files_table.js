/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('media_files', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('filename').notNullable();
    table.text('original_filename').notNullable();
    table.text('mime_type').notNullable();
    table.integer('file_size').notNullable();
    table.text('storage_path').notNullable();
    table.text('public_url').notNullable();
    table.text('entity_type');
    table.uuid('entity_id');
    table.text('field_name');
    table.uuid('uploaded_by').references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['entity_type', 'entity_id'], 'idx_media_entity');
    table.index('mime_type', 'idx_media_mime');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('media_files');
};
