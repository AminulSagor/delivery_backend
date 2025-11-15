import { Module } from '@nestjs/common';
import { HubsService } from './hubs.service';
import { HubsController } from './hubs.controller';

@Module({
  providers: [HubsService],
  controllers: [HubsController]
})
export class HubsModule {}
