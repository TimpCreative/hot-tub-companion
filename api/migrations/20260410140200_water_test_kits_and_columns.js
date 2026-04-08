exports.up = async function up(knex) {
  await knex.schema.createTable('water_test_kits', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('slug', 120).notNullable().unique();
    table.string('title', 200).notNullable();
    table.text('image_url');
    table.string('manufacturer', 200);
    table.string('status', 20).notNullable().defaultTo('draft');
    table.date('effective_from').nullable();
    table.string('review_status', 40).defaultTo('pending');
    table.text('source_notes');
    table.text('manufacturer_doc_url');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('water_test_kit_metrics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('kit_id')
      .notNullable()
      .references('id')
      .inTable('water_test_kits')
      .onDelete('CASCADE');
    table.string('metric_key', 80).notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.string('input_mode', 20).notNullable().defaultTo('numeric');
    table.jsonb('color_scale_json');
    table.text('help_copy');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['kit_id', 'metric_key']);
  });

  await knex.schema.alterTable('spa_profiles', (table) => {
    table.uuid('preferred_water_test_kit_id').nullable().references('id').inTable('water_test_kits').onDelete('SET NULL');
  });

  await knex.schema.alterTable('water_tests', (table) => {
    table.uuid('water_test_kit_id').nullable().references('id').inTable('water_test_kits').onDelete('SET NULL');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('water_tests', (table) => {
    table.dropColumn('water_test_kit_id');
  });
  await knex.schema.alterTable('spa_profiles', (table) => {
    table.dropColumn('preferred_water_test_kit_id');
  });
  await knex.schema.dropTableIfExists('water_test_kit_metrics');
  await knex.schema.dropTableIfExists('water_test_kits');
};
