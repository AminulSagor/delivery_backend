import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { Merchant } from '../merchant/entities/merchant.entity';
import { HubManager } from '../hubs/entities/hub-manager.entity';
import { Rider } from '../riders/entities/rider.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Merchant, HubManager, Rider]),
    UsersModule,
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
