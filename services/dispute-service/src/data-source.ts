import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DISPUTE_DB_HOST || 'localhost',
  port: parseInt(process.env.DISPUTE_DB_PORT || '5432', 10),
  database: process.env.DISPUTE_DB_NAME || 'dispute_db',
  username: process.env.DISPUTE_DB_USER || 'exchange',
  password: process.env.DISPUTE_DB_PASSWORD || 'exchange_dev_password',
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
