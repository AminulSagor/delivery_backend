import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('banks')
@Index(['is_active'])
@Index(['name'])
@Unique(['name', 'district', 'branch_name'])
export class Bank {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string; // e.g., "Dutch Bangla Bank Limited"

  @Column({ type: 'varchar', length: 255 })
  short_name: string; // e.g., "DBBL", "BRAC", "EBL"

  @Column({ type: 'varchar', length: 255, nullable: true })
  district: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  branch_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  routing: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 0 })
  display_order: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
