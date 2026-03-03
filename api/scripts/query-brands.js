#!/usr/bin/env node
/**
 * Quick script to query scdb_brands and see the raw API-style response.
 * Run: node api/scripts/query-brands.js
 * Or with Railway env: railway run node api/scripts/query-brands.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});

async function main() {
  try {
    const rows = await db('scdb_brands').select('*').whereNull('deleted_at');
    console.log('=== Raw rows from scdb_brands (deleted_at IS NULL) ===');
    console.log(JSON.stringify(rows, null, 2));
    console.log('\n=== Count:', rows.length);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}
main();
