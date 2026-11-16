import { MigrationInterface, QueryRunner, Table, TableUnique } from 'typeorm';

export class CreatePricingDefaults1794877200000 implements MigrationInterface {
  name = 'CreatePricingDefaults1794877200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('pricing_default_configurations'))) {
      await queryRunner.createTable(
        new Table({
          name: 'pricing_default_configurations',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'zone',
              type: 'enum',
              enum: ['INSIDE_DHAKA', 'SUB_DHAKA', 'OUTSIDE_DHAKA'],
            },
            {
              name: 'delivery_charge',
              type: 'decimal',
              precision: 10,
              scale: 2,
            },
            { name: 'weight_step_kg', type: 'decimal', precision: 5, scale: 2 },
            { name: 'cod_percentage', type: 'decimal', precision: 5, scale: 2 },
            {
              name: 'discount_percentage',
              type: 'decimal',
              precision: 5,
              scale: 2,
              default: 0,
            },
            { name: 'start_date', type: 'timestamp', isNullable: true },
            { name: 'end_date', type: 'timestamp', isNullable: true },
            { name: 'created_at', type: 'timestamp', default: 'now()' },
            { name: 'updated_at', type: 'timestamp', default: 'now()' },
          ],
          uniques: [new TableUnique({ columnNames: ['zone'] })],
        }),
        true,
      );
    }

    if (!(await queryRunner.hasTable('return_charge_default_configurations'))) {
      await queryRunner.createTable(
        new Table({
          name: 'return_charge_default_configurations',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'zone',
              type: 'enum',
              enum: ['INSIDE_DHAKA', 'SUB_DHAKA', 'OUTSIDE_DHAKA'],
            },
            {
              name: 'return_status',
              type: 'enum',
              enum: ['PARTIAL_DELIVERY', 'EXCHANGE', 'RETURNED', 'PAID_RETURN'],
            },
            {
              name: 'return_delivery_charge',
              type: 'decimal',
              precision: 10,
              scale: 2,
              default: 0,
            },
            {
              name: 'return_weight_charge_per_kg',
              type: 'decimal',
              precision: 10,
              scale: 2,
              default: 0,
            },
            {
              name: 'return_cod_percentage',
              type: 'decimal',
              precision: 5,
              scale: 2,
              default: 0,
            },
            {
              name: 'discount_percentage',
              type: 'decimal',
              precision: 5,
              scale: 2,
              default: 0,
            },
            { name: 'start_date', type: 'timestamp', isNullable: true },
            { name: 'end_date', type: 'timestamp', isNullable: true },
            { name: 'created_at', type: 'timestamp', default: 'now()' },
            { name: 'updated_at', type: 'timestamp', default: 'now()' },
          ],
          uniques: [
            new TableUnique({ columnNames: ['zone', 'return_status'] }),
          ],
        }),
        true,
      );
    }

    await queryRunner.query(`
      INSERT INTO "pricing_default_configurations"
        ("zone", "delivery_charge", "weight_step_kg", "cod_percentage",
         "discount_percentage", "start_date", "end_date")
      VALUES
        ('INSIDE_DHAKA', 70, 0.5, 0, 0, '2026-01-01', '2099-12-31 23:59:59.999'),
        ('SUB_DHAKA', 90, 1, 1, 0, '2026-01-01', '2099-12-31 23:59:59.999'),
        ('OUTSIDE_DHAKA', 110, 1, 1, 0, '2026-01-01', '2099-12-31 23:59:59.999')
      ON CONFLICT ("zone") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "return_charge_default_configurations"
        ("zone", "return_status", "return_delivery_charge",
         "return_weight_charge_per_kg", "return_cod_percentage",
         "discount_percentage", "start_date", "end_date")
      VALUES
        ('INSIDE_DHAKA', 'PARTIAL_DELIVERY', 0, 0, 0, 0, '2026-01-01', '2099-12-31 23:59:59.999'),
        ('INSIDE_DHAKA', 'EXCHANGE', 0, 0, 0, 0, '2026-01-01', '2099-12-31 23:59:59.999'),
        ('INSIDE_DHAKA', 'RETURNED', 0, 0, 0, 0, '2026-01-01', '2099-12-31 23:59:59.999'),
        ('INSIDE_DHAKA', 'PAID_RETURN', 0, 0, 0, 0, '2026-01-01', '2099-12-31 23:59:59.999'),
        ('SUB_DHAKA', 'PARTIAL_DELIVERY', 0, 0, 0, 0, '2026-01-01', '2099-12-31 23:59:59.999'),
        ('SUB_DHAKA', 'EXCHANGE', 0, 0, 0, 0, '2026-01-01', '2099-12-31 23:59:59.999'),
        ('SUB_DHAKA', 'RETURNED', 0, 0, 0, 0, '2026-01-01', '2099-12-31 23:59:59.999'),
        ('SUB_DHAKA', 'PAID_RETURN', 0, 0, 0, 0, '2026-01-01', '2099-12-31 23:59:59.999'),
        ('OUTSIDE_DHAKA', 'PARTIAL_DELIVERY', 0, 0, 0, 0, '2026-01-01', '2099-12-31 23:59:59.999'),
        ('OUTSIDE_DHAKA', 'EXCHANGE', 0, 0, 0, 0, '2026-01-01', '2099-12-31 23:59:59.999'),
        ('OUTSIDE_DHAKA', 'RETURNED', 0, 0, 0, 0, '2026-01-01', '2099-12-31 23:59:59.999'),
        ('OUTSIDE_DHAKA', 'PAID_RETURN', 0, 0, 0, 0, '2026-01-01', '2099-12-31 23:59:59.999')
      ON CONFLICT ("zone", "return_status") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('return_charge_default_configurations', true);
    await queryRunner.dropTable('pricing_default_configurations', true);
  }
}
