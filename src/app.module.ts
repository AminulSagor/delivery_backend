import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { MerchantModule } from './merchant/merchant.module';
import { UsersModule } from './users/users.module';
import { HubsModule } from './hubs/hubs.module';
import { RidersModule } from './riders/riders.module';
import { AuthModule } from './auth/auth.module';
import { StoresModule } from './stores/stores.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    AdminModule,
    MerchantModule,
    UsersModule,
    HubsModule,
    RidersModule,
    AuthModule,
    StoresModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
