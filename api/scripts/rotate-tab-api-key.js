#!/usr/bin/env node
/**
 * Rotate Take A Break tenant API key.
 * Run: railway run node scripts/rotate-tab-api-key.js
 * Or locally with DATABASE_URL set: node scripts/rotate-tab-api-key.js
 */
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const knex = require('knex');

const apiKey = `tab_dev_${crypto.randomBytes(16).toString('hex')}`;
const apiKeyHash = bcrypt.hashSync(apiKey, 10);

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});

async function rotate() {
  const [updated] = await db('tenants')
    .where({ slug: 'takeabreak' })
    .update({ api_key: apiKey, api_key_hash: apiKeyHash })
    .returning('id');

  if (!updated) {
    console.error('Tenant "takeabreak" not found.');
    process.exit(1);
  }

  console.log('\n✅ Take A Break API key rotated.');
  console.log('\nNew API key (update mobile/.env or expo.dev env, and dashboard/.env.local):');
  console.log(apiKey);
  console.log('\n');
  await db.destroy();
}

rotate().catch((err) => {
  console.error(err);
  process.exit(1);
});
