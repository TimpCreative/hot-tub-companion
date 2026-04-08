exports.up = async function up(knex) {
  await knex.schema.createTable('water_metrics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('metric_key', 80).notNullable().unique();
    table.string('label', 120).notNullable();
    table.string('unit', 40).notNullable();
    table.decimal('default_min_value', 10, 2).notNullable();
    table.decimal('default_max_value', 10, 2).notNullable();
    table.integer('sort_hint').notNullable().defaultTo(0);
    table.string('value_type', 20).notNullable().defaultTo('numeric');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('water_care_profile_metrics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('profile_id')
      .notNullable()
      .references('id')
      .inTable('water_care_profiles')
      .onDelete('CASCADE');
    table.uuid('metric_id').notNullable().references('id').inTable('water_metrics').onDelete('CASCADE');
    table.decimal('min_value', 10, 2).nullable();
    table.decimal('max_value', 10, 2).nullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.boolean('is_enabled').notNullable().defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['profile_id', 'metric_id']);
  });

  await knex.schema.raw('CREATE INDEX idx_wcpm_profile ON water_care_profile_metrics(profile_id)');

  const measurements = await knex('water_care_profile_measurements').select('*').orderBy('sort_order');
  const metricKeyToId = new Map();

  for (const row of measurements) {
    const key = row.metric_key;
    if (!metricKeyToId.has(key)) {
      const existing = await knex('water_metrics').where({ metric_key: key }).first();
      if (existing) {
        metricKeyToId.set(key, existing.id);
      } else {
        const [inserted] = await knex('water_metrics')
          .insert({
            metric_key: key,
            label: row.label,
            unit: row.unit,
            default_min_value: row.min_value,
            default_max_value: row.max_value,
            sort_hint: row.sort_order ?? 0,
            value_type: 'numeric',
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
          })
          .returning('id');
        const mid = typeof inserted === 'object' && inserted && 'id' in inserted ? inserted.id : inserted;
        metricKeyToId.set(key, mid);
      }
    }
    const metricId = metricKeyToId.get(key);
    await knex('water_care_profile_metrics').insert({
      profile_id: row.profile_id,
      metric_id: metricId,
      min_value: row.min_value,
      max_value: row.max_value,
      sort_order: row.sort_order ?? 0,
      is_enabled: row.is_enabled !== false,
      created_at: knex.fn.now(),
    });
  }

  await knex.schema.dropTableIfExists('water_care_profile_measurements');
};

exports.down = async function down(knex) {
  await knex.schema.createTable('water_care_profile_measurements', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('profile_id').notNullable().references('id').inTable('water_care_profiles').onDelete('CASCADE');
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
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_water_care_measurements_profile ON water_care_profile_measurements(profile_id)'
  );

  const rows = await knex('water_care_profile_metrics as wcpm')
    .join('water_metrics as wm', 'wcpm.metric_id', 'wm.id')
    .select(
      'wcpm.profile_id',
      'wm.metric_key',
      'wm.label',
      'wm.unit',
      knex.raw('COALESCE(wcpm.min_value, wm.default_min_value) as min_value'),
      knex.raw('COALESCE(wcpm.max_value, wm.default_max_value) as max_value'),
      'wcpm.sort_order',
      'wcpm.is_enabled'
    )
    .orderBy('wcpm.sort_order');
  for (const r of rows) {
    await knex('water_care_profile_measurements').insert({
      profile_id: r.profile_id,
      metric_key: r.metric_key,
      label: r.label,
      unit: r.unit,
      min_value: r.min_value,
      max_value: r.max_value,
      sort_order: r.sort_order,
      is_enabled: r.is_enabled,
      created_at: knex.fn.now(),
    });
  }

  await knex.schema.raw('DROP INDEX IF EXISTS idx_wcpm_profile');
  await knex.schema.dropTableIfExists('water_care_profile_metrics');
  await knex.schema.dropTableIfExists('water_metrics');
};
