import knex, { Knex } from 'knex';
import { env } from './environment';

const knexConfig: Knex.Config = {
  client: 'pg',
  connection: env.DATABASE_URL,
  pool: { min: 2, max: 10 },
};

export const db = knex(knexConfig);

export async function enablePgcrypto(): Promise<void> {
  await db.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');
}
