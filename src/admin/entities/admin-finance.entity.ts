import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
    Index
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('admin_finances')
// We might not have an "Admin" entity table, usually admin is just a User with role.
// For now, we can link it to a User ID who is an admin, or keep it singleton-like.
// Assuming we want to track finance PER admin user (if multiple admins handle cash)
// OR strict singleton for the system.
// Based on user request "admin has their main balance", linking to User (admin) is safer.
@Index(['admin_id'], { unique: true })
export class AdminFinance {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // ===== ADMIN REFERENCE =====
    @Column({ type: 'uuid', unique: true })
    admin_id: string;

    @OneToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'admin_id' })
    admin: User;

    // ===== BALANCE FIELDS =====
    /**
     * Current system balance available (Theoretical cash availability)
     * (Total Revenue + Total Collected - Total Paid)
     */
    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    current_system_balance: number;

    /**
     * Total Revenue (Profit)
     * Sum of Delivery Charges + COD Charges + Return Charges
     */
    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_revenue: number;

    /**
     * Total Cash Collected from Hubs
     */
    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_collected_from_hubs: number;

    /**
     * Total Payouts to Merchants
     */
    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_paid_to_merchants: number;

    // ===== LAST ACTIVITY =====
    @Column({ type: 'timestamp', nullable: true })
    last_collection_at: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    last_payout_at: Date | null;

    // ===== TIMESTAMPS =====
    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
