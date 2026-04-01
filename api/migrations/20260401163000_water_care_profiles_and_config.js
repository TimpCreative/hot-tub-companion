exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.jsonb('water_care_config');
  });

  await knex.schema.createTable('water_care_profiles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 120).notNullable().unique();
    table.text('description');
    table.text('notes');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('water_care_profile_measurements', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('profile_id')
      .notNullable()
      .references('id')
      .inTable('water_care_profiles')
      .onDelete('CASCADE');
    table.string('metric_key', 80).notNullable();
    table.string('label', 120).notNullable();
    table.string('unit', 40).notNullable();
    table.decimal('min_value', 10, 2).notNullable();
    table.decimal('max_value', 10, 2).notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.boolean('is_enabled').notNullable().defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['profile_id', 'metric_key']);
  });

  await knex.schema.createTable('water_care_profile_mappings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('scope_type', 40).notNullable();
    table.uuid('scope_id').nullable();
    table.string('sanitation_system_value', 80).nullable();
    table
      .uuid('profile_id')
      .notNullable()
      .references('id')
      .inTable('water_care_profiles')
      .onDelete('CASCADE');
    table.integer('priority').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.raw('CREATE INDEX idx_water_care_measurements_profile ON water_care_profile_measurements(profile_id)');
  await knex.schema.raw('CREATE INDEX idx_water_care_mappings_scope ON water_care_profile_mappings(scope_type, scope_id)');
  await knex.schema.raw('CREATE INDEX idx_water_care_mappings_system ON water_care_profile_mappings(sanitation_system_value)');
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('water_care_profile_mappings');
  await knex.schema.dropTableIfExists('water_care_profile_measurements');
  await knex.schema.dropTableIfExists('water_care_profiles');

  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('water_care_config');
  });
};
