import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffFrontendEnumValues1790551000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "staff_position_enum" ADD VALUE IF NOT EXISTS 'MANAGER'`,
    );
    await queryRunner.query(
      `ALTER TYPE "staff_position_enum" ADD VALUE IF NOT EXISTS 'ADMIN'`,
    );
    await queryRunner.query(
      `ALTER TYPE "staff_bike_type_enum" ADD VALUE IF NOT EXISTS 'CAR'`,
    );
  }

  // PostgreSQL enum values cannot be removed safely while rows may use them.
  public async down(): Promise<void> {}
}
