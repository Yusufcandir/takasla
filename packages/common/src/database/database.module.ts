import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export interface DatabaseModuleOptions {
  entities: Function[];
  migrationsDir?: string;
  dbHostEnv?: string;
  dbPortEnv?: string;
  dbNameEnv?: string;
  dbUserEnv?: string;
  dbPasswordEnv?: string;
}

@Module({})
export class DatabaseModule {
  private static readonly logger = new Logger(DatabaseModule.name);

  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService): TypeOrmModuleOptions => {
            const synchronize = config.get<string>('TYPEORM_SYNCHRONIZE', 'false') === 'true';
            const logging = config.get<string>('DB_LOGGING', 'false') === 'true';
            const migrationsRun = config.get<string>('TYPEORM_MIGRATIONS_RUN', 'true') === 'true';

            if (synchronize) {
              DatabaseModule.logger.warn(
                'TYPEORM_SYNCHRONIZE=true — schema will be auto-modified. Do NOT use in production!',
              );
            }

            const migrationsPath = options.migrationsDir
              ? join(options.migrationsDir, '*.{ts,js}')
              : undefined;

            return {
              type: 'postgres',
              host: config.get<string>(options.dbHostEnv || 'DB_HOST', 'localhost'),
              port: config.get<number>(options.dbPortEnv || 'DB_PORT', 5432),
              database: config.get<string>(options.dbNameEnv || 'DB_NAME'),
              username: config.get<string>(options.dbUserEnv || 'DB_USER', 'exchange'),
              password: config.get<string>(options.dbPasswordEnv || 'DB_PASSWORD', 'exchange_dev_password'),
              entities: options.entities,
              synchronize,
              logging,
              migrations: migrationsPath ? [migrationsPath] : [],
              migrationsRun: !synchronize && migrationsRun,
            };
          },
        }),
      ],
      exports: [TypeOrmModule],
    };
  }
}
