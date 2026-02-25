import path from 'path';
import type { Knex } from 'knex';

require('dotenv').config();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 },
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      extension: 'js',
    },
    seeds: {
      directory: path.join(__dirname, 'seeds'),
    },
  },
  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 },
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      extension: 'js',
    },
    seeds: {
      directory: path.join(__dirname, 'seeds'),
    },
  },
};

export default config;
