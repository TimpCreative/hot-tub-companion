/**
 * Stripe Connect + subscription bundle mirror tables (Part 4).
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.string('stripe_connect_account_id', 64).nullable();
    table.boolean('stripe_connect_charges_enabled').notNullable().defaultTo(false);
    table.boolean('stripe_connect_payouts_enabled').notNullable().defaultTo(false);
    table.boolean('stripe_connect_details_submitted').notNullable().defaultTo(false);
    table.timestamp('stripe_connect_updated_at').nullable();
    table.timestamp('stripe_onboarded_at').nullable();
    table.integer('subscription_application_fee_bps').nullable(); // e.g. 100 = 1.00%
    table.boolean('subscription_shopify_fulfillment_enabled').notNullable().defaultTo(false);
  });

  await knex.schema.createTable('subscription_bundle_definitions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('title', 200).notNullable();
    table.string('slug', 120).nullable();
    table.string('stripe_price_id', 120).notNullable(); // on connected account
    table.uuid('pos_product_id').nullable().references('id').inTable('pos_products').onDelete('SET NULL');
    table.jsonb('components').notNullable().defaultTo('[]'); // [{ posProductId, quantity }]
    table.boolean('active').notNullable().defaultTo(true);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.string('hero_subscribe_category', 80).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(
    'CREATE INDEX idx_subscription_bundles_tenant ON subscription_bundle_definitions(tenant_id)'
  );
  await knex.raw(
    'CREATE INDEX idx_subscription_bundles_pos_product ON subscription_bundle_definitions(tenant_id, pos_product_id)'
  );

  await knex.schema.createTable('customer_subscriptions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('spa_profile_id').nullable().references('id').inTable('spa_profiles').onDelete('SET NULL');
    table.uuid('bundle_id').nullable().references('id').inTable('subscription_bundle_definitions').onDelete('SET NULL');
    table.string('stripe_subscription_id', 80).notNullable().unique();
    table.string('stripe_customer_id', 80).notNullable();
    table.string('status', 40).notNullable().defaultTo('active');
    table.timestamp('current_period_end').nullable();
    table.boolean('cancel_at_period_end').notNullable().defaultTo(false);
    table.timestamp('canceled_at').nullable();
    table.jsonb('metadata').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(
    'CREATE INDEX idx_customer_subscriptions_user_tenant ON customer_subscriptions(user_id, tenant_id)'
  );
  await knex.raw(
    'CREATE INDEX idx_customer_subscriptions_tenant ON customer_subscriptions(tenant_id)'
  );

  await knex.schema.createTable('subscription_fulfillment_cycles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('customer_subscription_id').notNullable().references('id').inTable('customer_subscriptions').onDelete('CASCADE');
    table.string('stripe_invoice_id', 80).notNullable().unique();
    table.string('stripe_subscription_id', 80).notNullable();
    table.string('status', 32).notNullable().defaultTo('pending'); // pending, shopify_order_created, deferred, failed
    table.string('shopify_order_id', 64).nullable();
    table.string('shopify_order_name', 64).nullable();
    table.text('error_message').nullable();
    table.integer('attempt_count').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(
    'CREATE INDEX idx_sub_fulfillment_sub ON subscription_fulfillment_cycles(customer_subscription_id)'
  );

  await knex.schema.createTable('stripe_webhook_events', (table) => {
    table.string('stripe_event_id', 120).primary();
    table.string('event_type', 120).notNullable();
    table.timestamp('processed_at').notNullable().defaultTo(knex.fn.now());
    table.string('livemode', 8).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('stripe_webhook_events');
  await knex.schema.dropTableIfExists('subscription_fulfillment_cycles');
  await knex.schema.dropTableIfExists('customer_subscriptions');
  await knex.schema.dropTableIfExists('subscription_bundle_definitions');
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('stripe_connect_account_id');
    table.dropColumn('stripe_connect_charges_enabled');
    table.dropColumn('stripe_connect_payouts_enabled');
    table.dropColumn('stripe_connect_details_submitted');
    table.dropColumn('stripe_connect_updated_at');
    table.dropColumn('stripe_onboarded_at');
    table.dropColumn('subscription_application_fee_bps');
    table.dropColumn('subscription_shopify_fulfillment_enabled');
  });
};
