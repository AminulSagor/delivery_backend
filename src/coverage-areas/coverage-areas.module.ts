import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoverageAreasController } from './coverage-areas.controller';
import { CoverageAreasService } from './coverage-areas.service';
import { CoverageArea } from './entities/coverage-area.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CoverageArea])],
  controllers: [CoverageAreasController],
  providers: [CoverageAreasService],
  exports: [CoverageAreasService],
})
export class CoverageAreasModule {}
