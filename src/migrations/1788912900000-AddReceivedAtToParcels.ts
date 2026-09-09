import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddReceivedAtToParcels1788912900000
  implements MigrationInterface
{
  name = 'AddReceivedAtToParcels1788912900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('parcels', 'received_at'))) {
      await queryRunner.addColumn(
        'parcels',
        new TableColumn({
          name: 'received_at',
          type: 'timestamp',
          isNullable: true,
          comment: 'Timestamp when the parcel was first received at a hub',
        }),
      );
    }

    const hasTrackingEvents = await queryRunner.hasTable(
      'parcel_tracking_events',
    );

    if (hasTrackingEvents) {
      await queryRunner.query(`
        UPDATE "parcels" AS "parcel"
        SET "received_at" = COALESCE(
          (
            SELECT MIN("event"."occurred_at")
            FROM "parcel_tracking_events" AS "event"
            WHERE "event"."parcel_id" = "parcel"."id"
              AND "event"."event_type" IN ('HUB_RECEIVED', 'HUB_TRANSFER_RECEIVED')
          ),
          "parcel"."received_at_destination_hub",
          "parcel"."picked_up_at",
          "parcel"."updated_at"
        )
        WHERE "parcel"."received_at" IS NULL
          AND "parcel"."status" IN (
            'IN_HUB', 'ASSIGNED_TO_RIDER', 'ASSIGNED_TO_THIRD_PARTY',
            'OUT_FOR_DELIVERY', 'DELIVERED', 'PARTIAL_DELIVERY', 'EXCHANGE',
            'FAILED_DELIVERY', 'RETURNED_TO_HUB', 'RETURNED', 'PAID_RETURN',
            'RETURN_TO_MERCHANT', 'DELIVERY_RESCHEDULED'
          )
      `);
    } else {
      await queryRunner.query(`
        UPDATE "parcels"
        SET "received_at" = COALESCE(
          "received_at_destination_hub",
          "picked_up_at",
          "updated_at"
        )
        WHERE "received_at" IS NULL
          AND "status" IN (
            'IN_HUB', 'ASSIGNED_TO_RIDER', 'ASSIGNED_TO_THIRD_PARTY',
            'OUT_FOR_DELIVERY', 'DELIVERED', 'PARTIAL_DELIVERY', 'EXCHANGE',
            'FAILED_DELIVERY', 'RETURNED_TO_HUB', 'RETURNED', 'PAID_RETURN',
            'RETURN_TO_MERCHANT', 'DELIVERY_RESCHEDULED'
          )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('parcels', 'received_at')) {
      await queryRunner.dropColumn('parcels', 'received_at');
    }
  }
}
