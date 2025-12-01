import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';


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

    @Column({ type: 'varchar', length: 50, nullable: true, unique: true })
    secondary_number?: string | null;

    @Column({ type: 'text' })
    delivery_address: string;

}
