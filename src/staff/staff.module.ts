import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { Staff } from './entities/staff.entity';
import { User } from '../users/entities/user.entity';
import { Hub } from '../hubs/entities/hub.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Staff, User, Hub])],
  providers: [StaffService],
  controllers: [StaffController],
  exports: [StaffService],
})
export class StaffModule {}
