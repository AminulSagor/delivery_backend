import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddThirdPartyEnabledToHubs1790050000000
  implements MigrationInterface
{
  name = 'AddThirdPartyEnabledToHubs1790050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hubs" ADD COLUMN IF NOT EXISTS "third_party_enabled" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hubs" DROP COLUMN IF EXISTS "third_party_enabled"`,
    );
  }
}
