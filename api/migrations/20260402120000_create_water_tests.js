exports.up = async function up(knex) {
  await knex.schema.createTable('water_tests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('spa_profile_id').notNullable().references('id').inTable('spa_profiles').onDelete('CASCADE');
    table.timestamp('tested_at').notNullable().defaultTo(knex.fn.now());
    table.boolean('shared_with_retailer').notNullable().defaultTo(false);
    table.text('notes');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('water_test_measurements', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('water_test_id')
      .notNullable()
      .references('id')
      .inTable('water_tests')
      .onDelete('CASCADE');
    table.string('metric_key', 80).notNullable();
    table.decimal('value', 10, 2).notNullable();
    table.string('unit', 40).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['water_test_id', 'metric_key']);
  });

  await knex.schema.raw('CREATE INDEX idx_water_tests_spa_tested_at ON water_tests(spa_profile_id, tested_at DESC)');
  await knex.schema.raw('CREATE INDEX idx_water_test_measurements_test ON water_test_measurements(water_test_id)');
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('water_test_measurements');
  await knex.schema.dropTableIfExists('water_tests');
};
