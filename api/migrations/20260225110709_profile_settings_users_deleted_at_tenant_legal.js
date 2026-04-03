/**
 * Compatibility shim: some environments (e.g. staging) recorded this filename in knex_migrations
 * after a short-lived rename. The real migration is 20250318120000_profile_settings_users_deleted_at_tenant_legal.js
 * (idempotent). This file must exist so Knex validation passes for those DBs.
 */
exports.up = async function up() {
  // no-op: schema applied by 202503* or by this migration's previous content under the same name
};

exports.down = async function down() {
  // no-op
};
