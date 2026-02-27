/**
 * UHTD Migration 008: Seed Qualifiers
 * Insert initial qualifier definitions
 */

exports.up = async function (knex) {
  await knex('qdb_qualifiers').insert([
    {
      name: 'sanitization_system',
      display_name: 'Sanitization System',
      data_type: 'enum',
      allowed_values: JSON.stringify(['bromine', 'chlorine', 'frog_ease', 'copper', 'silver_mineral']),
      applies_to: 'both',
      description: 'The type of sanitization system used'
    },
    {
      name: 'voltage_requirement',
      display_name: 'Voltage Requirement',
      data_type: 'enum',
      allowed_values: JSON.stringify(['120V', '240V']),
      applies_to: 'both',
      description: 'Electrical voltage requirement'
    },
    {
      name: 'ozone_compatible',
      display_name: 'Ozone Compatible',
      data_type: 'boolean',
      allowed_values: null,
      applies_to: 'part',
      description: 'Whether the part is compatible with ozone systems'
    },
    {
      name: 'uv_compatible',
      display_name: 'UV Compatible',
      data_type: 'boolean',
      allowed_values: null,
      applies_to: 'part',
      description: 'Whether the part is compatible with UV sanitization'
    },
    {
      name: 'salt_compatible',
      display_name: 'Salt System Compatible',
      data_type: 'boolean',
      allowed_values: null,
      applies_to: 'part',
      description: 'Whether the part is compatible with salt water systems'
    }
  ]);
};

exports.down = async function (knex) {
  await knex('qdb_qualifiers').whereIn('name', [
    'sanitization_system',
    'voltage_requirement',
    'ozone_compatible',
    'uv_compatible',
    'salt_compatible'
  ]).del();
};
