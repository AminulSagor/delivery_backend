import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, In } from 'typeorm';
import { Rider } from '../entities/rider.entity';
import { Parcel, ParcelStatus, RIDER_DELIVERY_STATUSES } from '../../parcels/entities/parcel.entity';
import { PickupRequest } from '../../pickup-requests/entities/pickup-request.entity';
import { startOfDay, endOfDay, startOfMonth, subDays } from 'date-fns';

@Injectable()
export class RiderFinanceService {
    constructor(
        @InjectRepository(Rider)
        private riderRepository: Repository<Rider>,
        @InjectRepository(Parcel)
        private parcelRepository: Repository<Parcel>,
        @InjectRepository(PickupRequest)
        private pickupRequestRepository: Repository<PickupRequest>,
    ) { }

    async getFinanceSummaryByUserId(userId: string, startDate?: Date, endDate?: Date) {
        const rider = await this.riderRepository.findOne({ where: { user_id: userId } });
        if (!rider) throw new NotFoundException('Rider profile not found for this user');
        return this.getFinanceSummary(rider.id, startDate, endDate);
    }

    async getFinanceSummary(riderId: string, startDate?: Date, endDate?: Date) {
        // Validate Rider
        const rider = await this.riderRepository.findOne({ where: { id: riderId } });
        if (!rider) throw new NotFoundException('Rider not found');

        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        const monthStart = startOfMonth(new Date());

        // 1. Earning Today
        const earningsToday = await this.calculateEarnings(rider, todayStart, todayEnd);

        // 2. Earning This Month
        const earningsMonth = await this.calculateEarnings(rider, monthStart, todayEnd);

        // 3. Lifetime Cash Collection (Last 30 days as per user request)
        const thirtyDaysAgo = subDays(todayStart, 30);
        const lifetimeCashCollection = await this.calculateCashCollection(riderId, thirtyDaysAgo, todayEnd);

        // 4. COD Summary for Today
        const codSummary = await this.calculateCODSummary(riderId, todayStart, todayEnd);

        // 5. Detailed Summary (Default Today, or Custom Date Range)
        const summaryStart = startDate ? startOfDay(new Date(startDate)) : todayStart;
        const summaryEnd = endDate ? endOfDay(new Date(endDate)) : todayEnd;
        const detailedSummary = await this.calculateDetailedSummary(riderId, summaryStart, summaryEnd);

        return {
            earnings: {
                today: earningsToday,
                this_month: earningsMonth,
            },
            lifetime_cash_collection_30_days: lifetimeCashCollection,
            cod_summary_today: codSummary,
            summary: {
                date_range: {
                    start: summaryStart,
                    end: summaryEnd,
                },
                ...detailedSummary
            }
        };
    }

    private async calculateEarnings(rider: Rider, start: Date, end: Date): Promise<number> {
        // Commission is earned on successful delivery statuses
        const commissionableStatuses = [
            ParcelStatus.DELIVERED,
            ParcelStatus.PARTIAL_DELIVERY,
            ParcelStatus.EXCHANGE,
            ParcelStatus.PAID_RETURN,
        ];

        const count = await this.parcelRepository.count({
            where: {
                assigned_rider_id: rider.id,
                status: In(commissionableStatuses),
                delivered_at: Between(start, end),
            }
        });

        // Fixed commission per parcel
        return count * (Number(rider.commission_per_delivery) || 0);
    }

    private async calculateCashCollection(riderId: string, start: Date, end: Date): Promise<number> {
        // Cash collected from parcels
        // Assuming 'cod_collected_amount' is the field tracking actual cash collected by rider
        const { total } = await this.parcelRepository
            .createQueryBuilder('parcel')
            .select('SUM(parcel.cod_collected_amount)', 'total')
            .where('parcel.assigned_rider_id = :riderId', { riderId })
            .andWhere('parcel.delivered_at BETWEEN :start AND :end', { start, end })
            .getRawOne();

        return Number(total) || 0;
    }

    private async calculateCODSummary(riderId: string, start: Date, end: Date) {
        // Total Collected Amount (Today)
        const totalCollected = await this.calculateCashCollection(riderId, start, end);

        // Total Pending (Out for Delivery Today)
        // Pending amount is the expected COD amount for parcels currently out for delivery
        const { pending } = await this.parcelRepository
            .createQueryBuilder('parcel')
            .select('SUM(parcel.cod_amount)', 'pending')
            .where('parcel.assigned_rider_id = :riderId', { riderId })
            .andWhere('parcel.status = :status', { status: ParcelStatus.OUT_FOR_DELIVERY })
            // We might want to filter Out For Delivery parcels that were updated today, or just all currently OFD
            // User request says "Summary for Today", usually implies current state or active today.
            // Let's stick to status = OUT_FOR_DELIVERY (Live status)
            .getRawOne();

        const pendingAmount = Number(pending) || 0;

        return {
            total_collected_amount: totalCollected,
            total_pending: pendingAmount,
            total_collection: totalCollected + pendingAmount, // Total Expected + Collected
        };
    }

    private async calculateDetailedSummary(riderId: string, start: Date, end: Date) {
        // Helper to count parcels by status in range
        const countByStatus = async (statuses: ParcelStatus[]) => {
            return this.parcelRepository.count({
                where: {
                    assigned_rider_id: riderId,
                    status: In(statuses),
                    updated_at: Between(start, end) // specific status changes are best tracked by updated_at or specific timestamp fields if available
                    // For specific statuses like DELIVERED, we have delivered_at. For others, updated_at is a proxy.
                    // Given the schema has specific timestamps for some but not all, updated_at is a generic fallback
                    // but might catch non-status updates.
                    // Ideally we'd use a transaction log, but for now we look at current status + updated_at
                    // OR specifically map timestamps where available.
                }
            });
        };

        // For precise daily reporting on "Delivered/Partially Delivered/Exchange/Paid Return/Return", 
        // normally we use 'delivered_at' or the specific completion timestamp.
        // Schema has 'delivered_at'. It doesn't seem to have 'returned_at' etc explicitly, 
        // but 'updated_at' with status check works for a daily summary snapshot.

        // Better approach for strict "Events happened today":
        // Delivered -> delivered_at
        // Picked Up -> picked_up_at
        // Others -> updated_at (approximate)

        // 1. Total Parcel (Assigned to rider and active/completed in this period)
        // This is vague. "Total Parcel" usually means "Tasks for today".
        // Let's assume: Parcels completed today + Parcels currently active/assigned today.
        // OR simply Sum of all breakdown counts below.

        // Breakdown counts:
        const delivered = await this.parcelRepository.count({
            where: { assigned_rider_id: riderId, status: ParcelStatus.DELIVERED, delivered_at: Between(start, end) }
        });

        const partiallyDelivered = await this.parcelRepository.count({
            where: { assigned_rider_id: riderId, status: ParcelStatus.PARTIAL_DELIVERY, delivered_at: Between(start, end) }
        });

        // Exchange also typically has a delivered_at or similar completion time
        const exchanged = await this.parcelRepository.count({
            where: { assigned_rider_id: riderId, status: ParcelStatus.EXCHANGE, delivered_at: Between(start, end) }
        });

        // Paid Return - likely handled same as delivery flow in terms of timing
        const paidReturn = await this.parcelRepository.count({
            where: { assigned_rider_id: riderId, status: ParcelStatus.PAID_RETURN, updated_at: Between(start, end) }
        });

        // Return - Returned to Hub? Or just Returned from customer?
        // Status: RETURNED (from customer), RETURNED_TO_HUB (final)
        // User asked for "Return". Let's count 'RETURNED' (attempted delivery, failed, returning).
        const returned = await this.parcelRepository.count({
            where: { assigned_rider_id: riderId, status: ParcelStatus.RETURNED, updated_at: Between(start, end) }
        });

        const returnToMerchant = await this.parcelRepository.count({
            where: { assigned_rider_id: riderId, status: ParcelStatus.RETURN_TO_MERCHANT, updated_at: Between(start, end) }
        });

        // Price Change - Not a status. Likely an event. 
        // Schema doesn't have "PRICE_CHANGED" status. Checking for "Price Change" feature.
        // Assuming it's not implemented or handled as an issue.
        // I will return 0 for now or check if there's a flag.
        // Scanning schema... no obvious 'is_price_changed' flag. 
        const priceChange = 0;

        // Pickup (From Pickup Requests)
        const { pickupCount } = await this.pickupRequestRepository
            .createQueryBuilder('pr')
            .select('SUM(pr.picked_up_count)', 'pickupCount')
            .where('pr.completed_by_rider_id = :riderId', { riderId })
            .andWhere('pr.picked_up_at BETWEEN :start AND :end', { start, end })
            .getRawOne();

        const pickups = Number(pickupCount) || 0;

        const totalParcel = delivered + partiallyDelivered + exchanged + paidReturn + returned + returnToMerchant + pickups;

        return {
            total_parcel: totalParcel, // Sum of work done
            delivered,
            partially_delivered: partiallyDelivered,
            return: returned,
            paid_return: paidReturn,
            pickup: pickups,
            exchanged,
            return_to_merchant: returnToMerchant,
            price_change: priceChange,
        };
    }
}
