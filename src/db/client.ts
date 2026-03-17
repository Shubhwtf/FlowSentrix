import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { Database } from './types';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgres://user:password@localhost:5432/flowsentrix';

const pool = new Pool({
    connectionString,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

console.log(`[DB] Using connection string: ${connectionString.split('@').pop()}`);

const dialect = new PostgresDialect({
    pool,
});

export const db = new Kysely<Database>({
    dialect,
});

export const initializeDatabase = async () => {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
};
