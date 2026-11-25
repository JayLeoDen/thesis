import { existsSync, readFileSync } from 'node:fs';
import mariadb from 'mariadb';

for (var putanja of ['.env.local', '.env']) {
  if (existsSync(putanja)) process.loadEnvFile(putanja);
}

var env = process.env;
var spremna = Boolean(env.DB_HOST && env.DB_USER && env.DB_NAME);
var tls = env.DB_TLS === 'true' || Boolean(env.DB_SSL_CA_FILE);
var baza = spremna ? mariadb.createPool({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER,
  password: env.DB_PASSWORD || '',
  database: env.DB_NAME,
  ssl: tls ? { ca: env.DB_SSL_CA_FILE ? readFileSync(env.DB_SSL_CA_FILE) : undefined } : undefined,
  connectionLimit: 5,
  acquireTimeout: 5000,
  timezone: '+00:00'
}) : null;

export { baza };
