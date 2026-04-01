exports.up = async function up(knex) {
  await knex.schema.createTable('content_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('tenant_id')
      .nullable()
      .references('id')
      .inTable('tenants')
      .onDelete('CASCADE');
    table.string('scope', 20).notNullable().defaultTo('universal');
    table.string('title', 500).notNullable();
    table.string('slug', 500).notNullable();
    table.string('content_type', 20).notNullable();
    table.text('summary');
    table.text('body_markdown');
    table.text('video_provider');
    table.text('video_url');
    table.text('thumbnail_url');
    table.string('author', 100);
    table.string('video_format', 20);
    table
      .uuid('parent_content_id')
      .nullable()
      .references('id')
      .inTable('content_items')
      .onDelete('SET NULL');
    table.specificType('hidden_search_tags', 'text[]').notNullable().defaultTo('{}');
    table.specificType('hidden_search_aliases', 'text[]').notNullable().defaultTo('{}');
    table.text('transcript');
    table.string('status', 20).notNullable().defaultTo('draft');
    table.integer('priority').notNullable().defaultTo(0);
    table.boolean('is_published').notNullable().defaultTo(false);
    table.timestamp('published_at');
    table.integer('read_time_minutes');
    table.integer('view_count').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'status'], 'idx_content_items_tenant_status');
    table.index(['content_type', 'video_format'], 'idx_content_items_type_format');
    table.index(['is_published', 'published_at'], 'idx_content_items_published');
  });

  await knex.schema.raw(
    "CREATE UNIQUE INDEX idx_content_items_universal_slug ON content_items(slug) WHERE tenant_id IS NULL"
  );
  await knex.schema.raw(
    "CREATE UNIQUE INDEX idx_content_items_tenant_slug ON content_items(tenant_id, slug) WHERE tenant_id IS NOT NULL"
  );

  await knex.schema.createTable('content_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('key', 80).notNullable().unique();
    table.string('label', 120).notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('content_item_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('content_item_id')
      .notNullable()
      .references('id')
      .inTable('content_items')
      .onDelete('CASCADE');
    table
      .uuid('category_id')
      .notNullable()
      .references('id')
      .inTable('content_categories')
      .onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['content_item_id', 'category_id']);
    table.index(['category_id'], 'idx_content_item_categories_category');
  });

  await knex.schema.createTable('content_targets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('content_item_id')
      .notNullable()
      .references('id')
      .inTable('content_items')
      .onDelete('CASCADE');
    table.string('target_type', 40).notNullable();
    table.uuid('target_entity_id').nullable();
    table.string('target_value', 120).nullable();
    table.boolean('is_exclusion').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['content_item_id'], 'idx_content_targets_item');
    table.index(['target_type', 'target_entity_id'], 'idx_content_targets_entity');
    table.index(['target_type', 'target_value'], 'idx_content_targets_value');
  });

  await knex.schema.createTable('tenant_content_suppressions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('tenant_id')
      .notNullable()
      .references('id')
      .inTable('tenants')
      .onDelete('CASCADE');
    table
      .uuid('content_item_id')
      .notNullable()
      .references('id')
      .inTable('content_items')
      .onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'content_item_id']);
  });

  await knex('content_categories').insert([
    { key: 'getting_started', label: 'Getting Started', sort_order: 0, is_active: true },
    { key: 'water_care', label: 'Water Care', sort_order: 1, is_active: true },
    { key: 'maintenance', label: 'Maintenance', sort_order: 2, is_active: true },
    { key: 'troubleshooting', label: 'Troubleshooting', sort_order: 3, is_active: true },
    { key: 'seasonal', label: 'Seasonal', sort_order: 4, is_active: true },
  ]);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('tenant_content_suppressions');
  await knex.schema.dropTableIfExists('content_targets');
  await knex.schema.dropTableIfExists('content_item_categories');
  await knex.schema.dropTableIfExists('content_categories');
  await knex.schema.dropTableIfExists('content_items');
};
