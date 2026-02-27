/**
 * UHTD Migration 001: Extensions
 * Enable pg_trgm for typo-tolerant search
 */

exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm');
};

exports.down = async function (knex) {
  await knex.raw('DROP EXTENSION IF EXISTS pg_trgm');
};
