/**
 * Customer order snapshots for in-app order history (webhook + Admin API backfill).
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('order_references', (table) => {
    table.jsonb('snapshot').nullable();
    table.timestamp('ordered_at', { useTz: true }).nullable();
    table.string('currency', 8).nullable();
    table.bigInteger('total_cents').nullable();
    table.string('financial_status', 40).nullable();
  });
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_order_references_user_ordered
    ON order_references (user_id, ordered_at DESC NULLS LAST)
    WHERE user_id IS NOT NULL
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_order_references_user_ordered');
  await knex.schema.alterTable('order_references', (table) => {
    table.dropColumn('snapshot');
    table.dropColumn('ordered_at');
    table.dropColumn('currency');
    table.dropColumn('total_cents');
    table.dropColumn('financial_status');
  });
};
