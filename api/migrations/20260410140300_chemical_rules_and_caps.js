exports.up = async function up(knex) {
  await knex.schema.createTable('dose_caps', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('metric_key', 80).notNullable();
    table.string('sanitizer', 80).notNullable().defaultTo('');
    table.decimal('max_oz_per_dose', 10, 3).notNullable();
    table.decimal('max_oz_per_24h', 10, 3).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['metric_key', 'sanitizer']);
  });

  await knex.schema.createTable('chemical_rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('metric_key', 80).notNullable();
    table.string('sanitizer', 80).notNullable().defaultTo('');
    table.string('direction', 10).notNullable();
    table.string('suggested_chemical', 120).notNullable();
    table.decimal('oz_per_100gal_per_unit', 12, 6).notNullable();
    table.text('capful_hint');
    table.text('safety_note');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex('dose_caps').insert([
    {
      metric_key: 'free_chlorine',
      sanitizer: '',
      max_oz_per_dose: 4,
      max_oz_per_24h: 8,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      metric_key: 'ph',
      sanitizer: '',
      max_oz_per_dose: 8,
      max_oz_per_24h: 16,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
  ]);

  await knex('chemical_rules').insert([
    {
      metric_key: 'free_chlorine',
      sanitizer: '',
      direction: 'raise',
      suggested_chemical: 'Chlorine granules',
      oz_per_100gal_per_unit: 0.08,
      capful_hint: 'Start with a small dose; retest after 15 minutes.',
      safety_note: 'Do not exceed label directions. Informational only.',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      metric_key: 'free_chlorine',
      sanitizer: '',
      direction: 'lower',
      suggested_chemical: 'Allow natural dissipation or partial drain per dealer guidance',
      oz_per_100gal_per_unit: 0,
      capful_hint: null,
      safety_note: 'Consult your dealer before major water changes.',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      metric_key: 'ph',
      sanitizer: '',
      direction: 'raise',
      suggested_chemical: 'pH increaser (soda ash)',
      oz_per_100gal_per_unit: 0.12,
      capful_hint: 'Add gradually; circulate 15+ minutes before retest.',
      safety_note: 'Informational only; follow product label.',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      metric_key: 'ph',
      sanitizer: '',
      direction: 'lower',
      suggested_chemical: 'pH decreaser (dry acid)',
      oz_per_100gal_per_unit: 0.1,
      capful_hint: 'Add gradually; retest after circulation.',
      safety_note: 'Informational only; follow product label.',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
  ]);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('chemical_rules');
  await knex.schema.dropTableIfExists('dose_caps');
};
