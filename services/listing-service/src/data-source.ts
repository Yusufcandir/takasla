import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.LISTING_DB_HOST || 'localhost',
  port: parseInt(process.env.LISTING_DB_PORT || '5432', 10),
  database: process.env.LISTING_DB_NAME || 'listing_db',
  username: process.env.LISTING_DB_USER || 'exchange',
  password: process.env.LISTING_DB_PASSWORD || 'exchange_dev_password',
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
