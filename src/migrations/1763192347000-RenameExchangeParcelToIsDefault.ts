import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameExchangeParcelToIsDefault1763192347000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename the column from exchange_parcel to is_default
    await queryRunner.query(
      `ALTER TABLE "stores" RENAME COLUMN "exchange_parcel" TO "is_default"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert the column name back to exchange_parcel
    await queryRunner.query(
      `ALTER TABLE "stores" RENAME COLUMN "is_default" TO "exchange_parcel"`,
    );
  }
}
