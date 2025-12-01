import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRecipientCarrybeeLocationToParcel1732520000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'parcels',
      new TableColumn({
        name: 'recipient_carrybee_city_id',
        type: 'int',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'parcels',
      new TableColumn({
        name: 'recipient_carrybee_zone_id',
        type: 'int',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'parcels',
      new TableColumn({
        name: 'recipient_carrybee_area_id',
        type: 'int',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('parcels', 'recipient_carrybee_area_id');
    await queryRunner.dropColumn('parcels', 'recipient_carrybee_zone_id');
    await queryRunner.dropColumn('parcels', 'recipient_carrybee_city_id');
  }
}
