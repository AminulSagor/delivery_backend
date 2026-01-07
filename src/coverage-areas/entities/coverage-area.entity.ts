import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('coverage_areas')
@Unique('UQ_coverage_areas_carrybee_ids', ['city_id', 'zone_id', 'area_id'])
@Index('IDX_coverage_areas_city_id', ['city_id'])
@Index('IDX_coverage_areas_zone_id', ['zone_id'])
export class CoverageArea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  division: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'int' })
  city_id: number;

  @Column({ type: 'varchar', length: 100 })
  zone: string;

  @Column({ type: 'int' })
  zone_id: number;

  @Column({ type: 'varchar', length: 255 })
  area: string;

  @Column({ type: 'int' })
  area_id: number;

  @Column({ type: 'boolean', default: false })
  inside_dhaka_flag: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
