exports.up = async function (knex) {
  await knex.schema.createTable('super_admin_journal_entries', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('bucket', 32).notNullable().defaultTo('notes');
    table.integer('sort_order').notNullable().defaultTo(0);
    table.string('title', 255).notNullable();
    table.text('content').notNullable().defaultTo('');
    table.string('created_by', 255);
    table.string('updated_by', 255);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    "ALTER TABLE super_admin_journal_entries ADD CONSTRAINT super_admin_journal_entries_bucket_check CHECK (bucket IN ('notes', 'ideas', 'archive'))"
  );
  await knex.schema.raw(
    'CREATE INDEX idx_super_admin_journal_entries_bucket_sort_order ON super_admin_journal_entries(bucket, sort_order ASC, created_at ASC)'
  );
};

exports.down = async function (knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_super_admin_journal_entries_bucket_sort_order');
  await knex.schema.dropTableIfExists('super_admin_journal_entries');
};
