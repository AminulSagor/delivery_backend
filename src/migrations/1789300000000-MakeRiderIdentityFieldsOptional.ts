import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeRiderIdentityFieldsOptional1789300000000
  implements MigrationInterface
{
  name = 'MakeRiderIdentityFieldsOptional1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "riders" ALTER COLUMN "nid_number" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ALTER COLUMN "nid_number" DROP NOT NULL`,
    );
  }

  public async down(): Promise<void> {
    // Existing null values cannot safely be converted back to NOT NULL.
    // Keep the rollback non-destructive and require data backfill first.
  }
}
