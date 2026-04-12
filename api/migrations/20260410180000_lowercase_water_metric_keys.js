/**
 * Canonical metric_key values should be lowercase (e.g. ph, free_chlorine).
 * Normalize any legacy uppercase/mixed-case keys across related tables.
 *
 * Order: children first, then water_metrics (unique on metric_key).
 * Fails fast if lower(metric_key) would collide for two different water_metrics rows.
 */
exports.up = async function up(knex) {
  const wm = await knex('water_metrics').select('id', 'metric_key');
  const byLower = new Map();
  for (const row of wm) {
    const lk = String(row.metric_key).toLowerCase();
    if (!byLower.has(lk)) byLower.set(lk, []);
    byLower.get(lk).push(row);
  }
  for (const [, rows] of byLower) {
    if (rows.length > 1) {
      throw new Error(
        `water_metrics lowercase collision for "${String(rows[0].metric_key).toLowerCase()}": merge duplicates before running this migration`
      );
    }
  }

  await knex('water_test_kit_metrics').update({
    metric_key: knex.raw('lower(metric_key)'),
  });
  await knex('water_test_measurements').update({
    metric_key: knex.raw('lower(metric_key)'),
  });
  await knex('dose_caps').update({
    metric_key: knex.raw('lower(metric_key)'),
  });
  await knex('chemical_rules').update({
    metric_key: knex.raw('lower(metric_key)'),
  });
  await knex('water_metrics').update({
    metric_key: knex.raw('lower(metric_key)'),
  });
};

exports.down = async function down() {
  // Irreversible: we do not know original casing.
};
