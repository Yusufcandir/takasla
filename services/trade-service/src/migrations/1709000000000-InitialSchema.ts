import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1709000000000 implements MigrationInterface {
  // Baseline migration — schema was created by synchronize:true before migrations were adopted.
  // This migration exists so TypeORM knows the initial schema is already applied.
  async up(queryRunner: QueryRunner): Promise<void> {
    // No-op: schema already exists
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: do not drop existing schema
  }
}
