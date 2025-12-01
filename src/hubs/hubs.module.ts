import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HubsService } from './hubs.service';
import { HubsController } from './hubs.controller';
import { Hub } from './entities/hub.entity';
import { HubManager } from './entities/hub-manager.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ParcelsModule } from '../parcels/parcels.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Hub, HubManager, User]),
    forwardRef(() => ParcelsModule),
  ],
  providers: [HubsService, UsersService],
  controllers: [HubsController],
  exports: [HubsService],
})
export class HubsModule {}
