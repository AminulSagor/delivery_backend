import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThirdPartyProvider } from './entities/third-party-provider.entity';
import { ThirdPartyProvidersService } from './third-party-providers.service';
import { ThirdPartyProvidersController } from './third-party-providers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ThirdPartyProvider])],
  controllers: [ThirdPartyProvidersController],
  providers: [ThirdPartyProvidersService],
  exports: [ThirdPartyProvidersService],
})
export class ThirdPartyProvidersModule {}
