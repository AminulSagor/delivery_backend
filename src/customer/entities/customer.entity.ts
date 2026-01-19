import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { CoverageArea } from '../../coverage-areas/entities/coverage-area.entity';

@Entity('customers')
export class Customer {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'varchar',
        length: 255,

    })
    customer_name: string

    @Column({ type: 'varchar', length: 50, nullable: false, unique: true })
    phone_number: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    secondary_number?: string | null;

    @Column({ type: 'text' })
    customer_address: string;

    // Delivery Coverage Area (FK relationship)
    @Column({ type: 'uuid', nullable: true })
    delivery_coverage_area_id?: string | null;

    @ManyToOne(() => CoverageArea, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'delivery_coverage_area_id' })
    deliveryCoverageArea?: CoverageArea | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
