import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum LocationType {
  CITY = 'CITY',
  ZONE = 'ZONE',
  AREA = 'AREA',
}

@Entity('carrybee_locations')
@Index(['type', 'is_active'])
@Index(['parent_id'])
export class CarrybeeLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  carrybee_id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: LocationType,
  })
  type: LocationType;

  @Column({ type: 'int', nullable: true })
  parent_id: number | null; // For zone (parent = city_id), for area (parent = zone_id)

  @Column({ type: 'int', nullable: true })
  city_id: number | null; // For quick filtering

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
