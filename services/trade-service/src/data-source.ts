import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { OutboxEntity } from '@exchange/common';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.TRADE_DB_HOST || 'localhost',
  port: parseInt(process.env.TRADE_DB_PORT || '5432', 10),
  database: process.env.TRADE_DB_NAME || 'trade_db',
  username: process.env.TRADE_DB_USER || 'exchange',
  password: process.env.TRADE_DB_PASSWORD || 'exchange_dev_password',
  entities: [join(__dirname, '**', '*.entity.{ts,js}'), OutboxEntity],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
