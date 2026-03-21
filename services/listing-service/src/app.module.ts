import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { DatabaseModule, RabbitMQModule, HealthModule, StorageModule, SightEngineModule } from '@exchange/common';
import { ListingsModule } from './listings/listings.module';
import { CategoriesModule } from './categories/categories.module';
import { ListingEntity } from './listings/listing.entity';
import { ListingImageEntity } from './listings/listing-image.entity';
import { ListingQuestionEntity } from './listings/listing-question.entity';
import { ListingFavoriteEntity } from './listings/listing-favorite.entity';
import { ListingReportEntity } from './listings/listing-report.entity';
import { CategoryEntity } from './categories/category.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot({
      entities: [ListingEntity, ListingImageEntity, ListingQuestionEntity, ListingFavoriteEntity, ListingReportEntity, CategoryEntity],
      migrationsDir: join(__dirname, 'migrations'),
      dbHostEnv: 'LISTING_DB_HOST',
      dbPortEnv: 'LISTING_DB_PORT',
      dbNameEnv: 'LISTING_DB_NAME',
      dbUserEnv: 'LISTING_DB_USER',
      dbPasswordEnv: 'LISTING_DB_PASSWORD',
    }),
    RabbitMQModule.forRoot(),
    StorageModule.forRoot(),
    SightEngineModule.forRoot(),
    HealthModule,
    ListingsModule,
    CategoriesModule,
  ],
})
export class AppModule {}
