import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
} from 'typeorm';
import { HubManager } from './hub-manager.entity';
import { Hub } from './hub.entity';

@Entity('hub_manager_finances')
@Index(['hub_manager_id'], { unique: true })
@Index(['hub_id'])
export class HubManagerFinance {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // ===== HUB MANAGER REFERENCE =====
    @Column({ type: 'uuid', unique: true })
    hub_manager_id: string;

    @OneToOne(() => HubManager, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'hub_manager_id' })
    hubManager: HubManager;

    @Column({ type: 'uuid' })
    hub_id: string;

    @ManyToOne(() => Hub)
    @JoinColumn({ name: 'hub_id' })
    hub: Hub;

    // ===== BALANCE FIELDS =====
    /**
     * Current cash holding (Collected from Riders - Transferred to Admin)
     */
    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    current_balance: number;

    /**
     * Total cash collected from riders (lifetime)
     */
    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    total_collected_from_riders: number;

    /**
     * Total cash transferred to admin (lifetime)
     */
    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    total_transferred_to_admin: number;

    // ===== LAST ACTIVITY =====
    @Column({ type: 'timestamp', nullable: true })
    last_collection_at: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    last_transfer_at: Date | null;

    // ===== TIMESTAMPS =====
    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
