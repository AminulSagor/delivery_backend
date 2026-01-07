import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoverageAreasController } from './coverage-areas.controller';
import { CoverageAreasService } from './coverage-areas.service';
import { CoverageArea } from './entities/coverage-area.entity';
import { CarrybeeModule } from '../carrybee/carrybee.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CoverageArea]),
    CarrybeeModule,
  ],
  controllers: [CoverageAreasController],
  providers: [CoverageAreasService],
  exports: [CoverageAreasService],
})
export class CoverageAreasModule {}
