import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { OutboxEntity } from '@exchange/common';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.PAYMENT_DB_HOST || 'localhost',
  port: parseInt(process.env.PAYMENT_DB_PORT || '5432', 10),
  database: process.env.PAYMENT_DB_NAME || 'payment_db',
  username: process.env.PAYMENT_DB_USER || 'exchange',
  password: process.env.PAYMENT_DB_PASSWORD || 'exchange_dev_password',
  entities: [join(__dirname, '**', '*.entity.{ts,js}'), OutboxEntity],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
