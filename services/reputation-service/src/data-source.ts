import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.REPUTATION_DB_HOST || 'localhost',
  port: parseInt(process.env.REPUTATION_DB_PORT || '5432', 10),
  database: process.env.REPUTATION_DB_NAME || 'reputation_db',
  username: process.env.REPUTATION_DB_USER || 'exchange',
  password: process.env.REPUTATION_DB_PASSWORD || 'exchange_dev_password',
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
