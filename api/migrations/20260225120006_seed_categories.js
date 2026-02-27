/**
 * UHTD Migration 007: Seed Part Categories
 * Insert the 15 standard part categories
 */

exports.up = async function (knex) {
  await knex('pcdb_categories').insert([
    { name: 'filter', display_name: 'Filters', sort_order: 1 },
    { name: 'cover', display_name: 'Covers', sort_order: 2 },
    { name: 'chemical', display_name: 'Chemicals', sort_order: 3 },
    { name: 'pump', display_name: 'Pumps', sort_order: 4 },
    { name: 'jet', display_name: 'Jets', sort_order: 5 },
    { name: 'heater', display_name: 'Heaters', sort_order: 6 },
    { name: 'control_panel', display_name: 'Control Panels', sort_order: 7 },
    { name: 'pillow', display_name: 'Pillows & Headrests', sort_order: 8 },
    { name: 'cover_lifter', display_name: 'Cover Lifters', sort_order: 9 },
    { name: 'steps', display_name: 'Steps & Accessories', sort_order: 10 },
    { name: 'ozonator', display_name: 'Ozonators', sort_order: 11 },
    { name: 'circulation_pump', display_name: 'Circulation Pumps', sort_order: 12 },
    { name: 'blower', display_name: 'Blowers', sort_order: 13 },
    { name: 'light', display_name: 'Lights', sort_order: 14 },
    { name: 'plumbing', display_name: 'Plumbing & Fittings', sort_order: 15 },
  ]);
};

exports.down = async function (knex) {
  await knex('pcdb_categories').whereIn('name', [
    'filter', 'cover', 'chemical', 'pump', 'jet', 'heater', 
    'control_panel', 'pillow', 'cover_lifter', 'steps', 
    'ozonator', 'circulation_pump', 'blower', 'light', 'plumbing'
  ]).del();
};
