import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Parcel, ParcelStatus, PaymentStatus } from '../parcels/entities/parcel.entity';
import { ReturnChargeConfiguration, ReturnStatus } from '../pricing/entities/return-charge-configuration.entity';
import { CarrybeeWebhookDto } from './dto/carrybee-webhook.dto';

@Injectable()
export class CarrybeeWebhookService {
  private readonly logger = new Logger(CarrybeeWebhookService.name);
  private readonly webhookSignature: string;

  constructor(
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(ReturnChargeConfiguration)
    private readonly returnChargeConfigRepo: Repository<ReturnChargeConfiguration>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.webhookSignature = this.configService.get<string>(
      'CARRYBEE_WEBHOOK_SIGNATURE',
      'default-signature',
    );
  }

  verifySignature(signature: string): boolean {
    if (!signature) {
      return false;
    }
    return signature === this.webhookSignature;
  }

  async handleWebhook(payload: CarrybeeWebhookDto, signature: string) {
    // Verify signature
    if (!this.verifySignature(signature)) {
      this.logger.warn('Invalid webhook signature received');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log(`Received Carrybee webhook: ${payload.event} for ${payload.consignment_id}`);

    // Use transaction for atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find parcel by Carrybee consignment ID with store relation for charge calculation
      const parcel = await queryRunner.manager.findOne(Parcel, {
        where: { carrybee_consignment_id: payload.consignment_id },
        relations: ['store', 'delivery_coverage_area'],
      });

      if (!parcel) {
        await queryRunner.rollbackTransaction();
        this.logger.error(`Parcel not found for consignment ${payload.consignment_id}`);
        return {
          success: false,
          message: 'Parcel not found',
        };
      }

      // Map Carrybee event to parcel status
      const newStatus = this.mapEventToStatus(payload.event);

      if (!newStatus) {
        await queryRunner.rollbackTransaction();
        this.logger.warn(`Unknown Carrybee event: ${payload.event}`);
        return {
          success: false,
          message: 'Unknown event type',
        };
      }

      // ✅ IDEMPOTENCY CHECK: Skip if already in this status
      if (parcel.status === newStatus) {
        await queryRunner.rollbackTransaction();
        this.logger.log(
          `Parcel ${parcel.id} already in status ${newStatus}. Skipping duplicate webhook.`,
        );
        return {
          success: true,
          message: 'Webhook already processed (idempotent)',
        };
      }

      // Update status
      parcel.status = newStatus;

      // ✅ Handle different event types with proper financial fields
      switch (payload.event) {
        case 'order.delivered':
          await this.handleDelivered(parcel, payload);
          break;

        case 'order.returned':
        case 'order.returned-to-merchant':
          await this.handleReturned(parcel, payload, queryRunner.manager);
          break;

        case 'order.picked':
          parcel.picked_up_at = new Date();
          break;

        case 'order.delivery-failed':
          parcel.delivered_at = new Date();
          if (payload.reason) {
            parcel.return_reason = payload.reason;
          }
          break;

        default:
          // For other events (in-transit, at-sorting-hub, etc.), just update status
          break;
      }

      // Save parcel
      await queryRunner.manager.save(Parcel, parcel);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Parcel ${parcel.id} updated from Carrybee webhook: ${payload.event} -> ${newStatus}`,
      );

      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to process Carrybee webhook: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handle delivered event - set financial fields
   */
  private async handleDelivered(parcel: Parcel, payload: CarrybeeWebhookDto) {
    parcel.delivered_at = new Date();

    // Set financial fields properly
    if (payload.collected_amount) {
      parcel.cod_collected_amount = parseFloat(payload.collected_amount);
      parcel.payment_status = PaymentStatus.COD_COLLECTED;
    } else {
      parcel.cod_collected_amount = 0;
      parcel.payment_status = PaymentStatus.UNPAID;
    }

    // Set charge flags for delivered parcels
    parcel.delivery_charge_applicable = true;
    parcel.return_charge_applicable = false;
    parcel.return_charge = 0;
    parcel.paid_to_merchant = false; // Ready for clearance
  }

  /**
   * Handle returned event - calculate return charges
   */
  private async handleReturned(
    parcel: Parcel,
    payload: CarrybeeWebhookDto,
    manager: any,
  ) {
    parcel.delivered_at = new Date();
    parcel.cod_collected_amount = 0;
    parcel.payment_status = PaymentStatus.UNPAID;
    parcel.delivery_charge_applicable = false;
    parcel.return_charge_applicable = true;
    parcel.paid_to_merchant = false;

    if (payload.reason) {
      parcel.return_reason = payload.reason;
    }

    // ✅ Calculate return charge based on zone and store config
    if (parcel.store_id) {
      const returnCharge = await this.calculateReturnCharge(
        parcel,
        ReturnStatus.RETURNED,
        manager,
      );
      parcel.return_charge = returnCharge;
    }
  }

  /**
   * Calculate return charge based on store configuration and parcel zone
   */
  private async calculateReturnCharge(
    parcel: Parcel,
    returnStatus: ReturnStatus,
    manager: any,
  ): Promise<number> {
    if (!parcel.store_id) {
      return 0;
    }

    // Determine pricing zone based on delivery area
    const zone = this.determinePricingZone(parcel);

    // Look up return charge configuration for this store, status, and zone
    const config = await manager.findOne(ReturnChargeConfiguration, {
      where: {
        store_id: parcel.store_id,
        return_status: returnStatus,
        zone: zone,
      },
    });

    if (!config) {
      this.logger.warn(
        `No return charge config found for store ${parcel.store_id}, zone ${zone}, status ${returnStatus}`,
      );
      return 0;
    }

    return Number(config.charge_amount || 0);
  }

  /**
   * Determine pricing zone from parcel's delivery area
   */
  private determinePricingZone(parcel: Parcel): string {
    if (!parcel.delivery_coverage_area) {
      return 'inside_dhaka'; // Default
    }

    const areaName = parcel.delivery_coverage_area.area?.toLowerCase() || '';

    if (areaName.includes('dhaka') || areaName.includes('city')) {
      return 'inside_dhaka';
    } else if (areaName.includes('sub') || areaName.includes('suburban')) {
      return 'sub_city';
    } else {
      return 'outside_dhaka';
    }
  }

  private mapEventToStatus(event: string): ParcelStatus | null {
    const eventStatusMap: Record<string, ParcelStatus> = {
      'order.picked': ParcelStatus.PICKED_UP,
      'order.at-the-sorting-hub': ParcelStatus.IN_HUB,
      'order.in-transit': ParcelStatus.IN_TRANSIT,
      'order.assigned-for-delivery': ParcelStatus.OUT_FOR_DELIVERY,
      'order.delivered': ParcelStatus.DELIVERED,
      'order.delivery-failed': ParcelStatus.FAILED_DELIVERY,
      'order.returned': ParcelStatus.RETURNED,
      'order.returned-to-merchant': ParcelStatus.RETURNED,
      'order.pickup-cancelled': ParcelStatus.CANCELLED,
    };

    return eventStatusMap[event] || null;
  }
}
