import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel, ParcelStatus } from '../parcels/entities/parcel.entity';
import { CarrybeeWebhookDto } from './dto/carrybee-webhook.dto';

@Injectable()
export class CarrybeeWebhookService {
  private readonly logger = new Logger(CarrybeeWebhookService.name);
  private readonly webhookSignature: string;

  constructor(
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
    private readonly configService: ConfigService,
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

    // Find parcel by Carrybee consignment ID
    const parcel = await this.parcelRepository.findOne({
      where: { carrybee_consignment_id: payload.consignment_id },
    });

    if (!parcel) {
      this.logger.error(`Parcel not found for consignment ${payload.consignment_id}`);
      // Don't throw error - just log and return
      return {
        success: false,
        message: 'Parcel not found',
      };
    }

    // Map Carrybee event to parcel status
    const newStatus = this.mapEventToStatus(payload.event);

    if (newStatus) {
      parcel.status = newStatus;
    }

    // Update additional fields based on event
    if (payload.event === 'order.delivered' && payload.collected_amount) {
      parcel.cod_amount = parseFloat(payload.collected_amount);
      parcel.delivered_at = new Date();
    }

    if (payload.event === 'order.picked') {
      parcel.picked_up_at = new Date();
    }

    if (payload.reason) {
      parcel.return_reason = payload.reason;
    }

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `Parcel ${parcel.id} updated from Carrybee webhook: ${payload.event} -> ${newStatus || 'no status change'}`,
    );

    return {
      success: true,
      message: 'Webhook processed successfully',
    };
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
