/**
 * Qualifiers Overhaul - Phase 1.4: Seed sections and replace qualifier definitions
 */

exports.up = async function (knex) {
  // Insert sections
  const [specSection] = await knex('qdb_sections').insert({ name: 'Specifications', sort_order: 0 }).returning('id');
  const [optSection] = await knex('qdb_sections').insert({ name: 'Options', sort_order: 1 }).returning('id');

  const specId = specSection.id;

  // Delete old qualifier data (brand_qualifiers is new and likely empty)
  await knex('brand_qualifiers').del();
  await knex('qdb_spa_qualifiers').del();
  await knex('qdb_part_qualifiers').del();
  await knex('qdb_qualifiers').del();

  // Jacuzzi brand for jacuzzi_true option - lookup by name (may not exist)
  const jacuzzi = await knex('scdb_brands').where('name', 'ilike', 'Jacuzzi').first();
  const jacuzziIds = jacuzzi ? [jacuzzi.id] : [];

  // Insert new qualifiers
  await knex('qdb_qualifiers').insert([
    {
      name: 'electrical_configs',
      display_name: 'Electrical Configurations',
      data_type: 'array',
      allowed_values: null, // Array of { voltage, voltageUnit, frequencyHz, amperage } - no fixed options
      applies_to: 'both',
      description: 'Electrical configurations (e.g. 240V/50A, 120V/15A)',
      section_id: specId,
      is_universal: true,
      is_required: true,
    },
    {
      name: 'sanitization_systems',
      display_name: 'Sanitization Systems',
      data_type: 'array',
      allowed_values: JSON.stringify([
        { value: 'ozone', displayName: 'Ozone', brandIds: null },
        { value: 'uv', displayName: 'UV', brandIds: null },
        { value: 'salt', displayName: 'Salt System', brandIds: null },
        { value: 'jacuzzi_true', displayName: 'Jacuzzi True', brandIds: jacuzziIds },
      ]),
      applies_to: 'both',
      description: 'Sanitization systems included (ozone, UV, salt, Jacuzzi True)',
      section_id: specId,
      is_universal: true,
      is_required: false,
    },
    {
      name: 'voltage_requirement',
      display_name: 'Voltage Requirement',
      data_type: 'enum',
      allowed_values: JSON.stringify([
        { value: '120V', displayName: '120V', brandIds: null },
        { value: '240V', displayName: '240V', brandIds: null },
      ]),
      applies_to: 'both',
      description: 'Primary electrical voltage requirement',
      section_id: specId,
      is_universal: true,
      is_required: false,
    },
  ]);
};

exports.down = async function (knex) {
  await knex('brand_qualifiers').del();
  await knex('qdb_spa_qualifiers').del();
  await knex('qdb_part_qualifiers').del();
  await knex('qdb_qualifiers').del();
  await knex('qdb_sections').del();

  // Restore old qualifier seed
  await knex('qdb_qualifiers').insert([
    { name: 'sanitization_system', display_name: 'Sanitization System', data_type: 'enum', allowed_values: JSON.stringify(['bromine', 'chlorine', 'frog_ease', 'copper', 'silver_mineral']), applies_to: 'both', description: 'The type of sanitization system used' },
    { name: 'voltage_requirement', display_name: 'Voltage Requirement', data_type: 'enum', allowed_values: JSON.stringify(['120V', '240V']), applies_to: 'both', description: 'Electrical voltage requirement' },
    { name: 'ozone_compatible', display_name: 'Ozone Compatible', data_type: 'boolean', allowed_values: null, applies_to: 'part', description: 'Whether the part is compatible with ozone systems' },
    { name: 'uv_compatible', display_name: 'UV Compatible', data_type: 'boolean', allowed_values: null, applies_to: 'part', description: 'Whether the part is compatible with UV sanitization' },
    { name: 'salt_compatible', display_name: 'Salt System Compatible', data_type: 'boolean', allowed_values: null, applies_to: 'part', description: 'Whether the part is compatible with salt water systems' },
  ]);
};
