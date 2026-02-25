const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const apiKey = `tab_dev_${crypto.randomBytes(16).toString('hex')}`;
const apiKeyHash = bcrypt.hashSync(apiKey, 10);

exports.seed = async function (knex) {
  await knex('tenants').del();
  await knex('tenants').insert([
    {
      name: 'Take A Break Spas & Billiards',
      slug: 'takeabreak',
      api_key: apiKey,
      api_key_hash: apiKeyHash,
      primary_color: '#1B4D7A',
      secondary_color: '#E8A832',
      status: 'active',
      pos_type: 'shopify',
      feature_subscriptions: true,
      feature_loyalty: true,
      feature_referrals: false,
      feature_water_care: true,
      feature_service_scheduling: true,
      feature_seasonal_timeline: true,
      fulfillment_mode: 'self',
    },
  ]);

  console.log(`\nTAB tenant created. API key (save for mobile config): ${apiKey}\n`);
};
