import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Rider } from './rider.entity';
import { PayoutMethodType } from '../../common/enums/payout-method-type.enum';
import {
  BkashAccountType,
  NagadAccountType,
} from '../../common/enums/account-type.enum';

@Entity('rider_payout_methods')
@Index(['rider_id', 'method_type'])
@Index(['rider_id', 'is_default'])
@Index(['rider_id', 'is_active'])
export class RiderPayoutMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  rider_id: string;

  @ManyToOne(() => Rider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rider_id' })
  rider: Rider;

  @Column({
    type: 'enum',
    enum: PayoutMethodType,
  })
  method_type: PayoutMethodType;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bank_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  branch_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  account_holder_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  account_number: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  routing_number: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  bkash_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bkash_account_holder_name: string | null;

  @Column({
    type: 'enum',
    enum: BkashAccountType,
    nullable: true,
  })
  bkash_account_type: BkashAccountType | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  nagad_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nagad_account_holder_name: string | null;

  @Column({
    type: 'enum',
    enum: NagadAccountType,
    nullable: true,
  })
  nagad_account_type: NagadAccountType | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
