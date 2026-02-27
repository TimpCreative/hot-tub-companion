/**
 * Data Source Service
 * Aggregates unique data_source values from UHTD tables with fuzzy matching
 */

import { db } from '../config/database';

export interface DataSourceMatch {
  value: string;
  count: number;
  similarity: number;
}

function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function calculateSimilarity(search: string, value: string): number {
  const normalizedSearch = normalize(search);
  const normalizedValue = normalize(value);

  if (normalizedValue === normalizedSearch) return 1;
  if (normalizedValue.includes(normalizedSearch)) return 0.9;
  if (normalizedSearch.includes(normalizedValue)) return 0.8;

  const maxLen = Math.max(normalizedSearch.length, normalizedValue.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(normalizedSearch, normalizedValue);
  return Math.max(0, 1 - distance / maxLen);
}

export async function getDataSources(search?: string): Promise<DataSourceMatch[]> {
  const tables = [
    { table: 'scdb_brands', column: 'data_source' },
    { table: 'scdb_model_lines', column: 'data_source' },
    { table: 'scdb_spa_models', column: 'data_source' },
    { table: 'pcdb_parts', column: 'data_source' },
  ];

  const queries = tables.map(({ table, column }) =>
    db(table)
      .select(db.raw(`${column} as value`))
      .whereNotNull(column)
      .where(column, '!=', '')
      .groupBy(column)
  );

  const results = await Promise.all(queries);
  const allValues = results.flat();

  const valueCounts = new Map<string, number>();
  for (const row of allValues) {
    const normalizedKey = normalize(row.value);
    const existing = valueCounts.get(normalizedKey);
    if (existing !== undefined) {
      valueCounts.set(normalizedKey, existing + 1);
    } else {
      valueCounts.set(normalizedKey, 1);
    }
  }

  const uniqueValuesMap = new Map<string, string>();
  for (const row of allValues) {
    const normalizedKey = normalize(row.value);
    if (!uniqueValuesMap.has(normalizedKey)) {
      uniqueValuesMap.set(normalizedKey, row.value);
    }
  }

  let dataSources: DataSourceMatch[] = Array.from(uniqueValuesMap.entries()).map(
    ([normalizedKey, originalValue]) => ({
      value: originalValue,
      count: valueCounts.get(normalizedKey) || 1,
      similarity: search ? calculateSimilarity(search, originalValue) : 1,
    })
  );

  if (search) {
    dataSources = dataSources
      .filter((ds) => ds.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity);
  } else {
    dataSources.sort((a, b) => b.count - a.count);
  }

  return dataSources.slice(0, 20);
}
