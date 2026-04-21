import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('banks')
@Index(['is_active'])
export class Bank {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  short_name: string; // e.g., "DBBL", "BRAC", "EBL"

  @Column({ type: 'varchar', length: 255 })
  district: string;

  @Column({ type: 'varchar', length: 255 })
  branch_name: string;

  @Column({ type: 'varchar', length: 255 })
  routing: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 0 })
  display_order: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}