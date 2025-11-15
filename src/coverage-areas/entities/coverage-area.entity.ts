import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('coverage_areas')
export class CoverageArea {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  division: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  district: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  zone: string | null;

  @Column({ type: 'varchar', length: 255 })
  area: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  coverage: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  delivery_type: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  pickup: string | null;

  @Column({ type: 'boolean', default: false })
  inside_dhaka_flag: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
