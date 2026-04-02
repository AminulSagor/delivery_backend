import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { RiderFinanceService } from '../services/riders-finance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { GetUser } from '../../auth/decorators/get-user.decorator'; // Assuming this exists or using Request
import { User } from '../../users/entities/user.entity';

@Controller('riders/finance')
@UseGuards(JwtAuthGuard)
export class RiderFinanceController {
  constructor(private readonly riderFinanceService: RiderFinanceService) {}

  @Get('summary')
  async getFinanceSummary(
    @Req() req: any, // Using Req to get user from guard
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Assuming the JWT strategy attaches certain rider info or user info
    // We need the RIDER ID, not just User ID.
    // Typically, req.user is the User entity. We need to find the associated Rider.
    // However, the service method 'getFinanceSummary' takes riderId.
    // We should resolve riderId from the logged-in user.
    // For now, I'll assume req.user has a rider_id or I fetch it.

    // Wait, typical pattern: Rider is linked to User.
    const userId = req.user.id;

    // We need to fetch the riderId for this userId or trust the guard/strategy provided it.
    // Ideally, I should inject RidersService to find Rider by User ID, but let's see if usage allows passing User ID
    // or if I should update RidersService to handle this lookup.

    // Actually, looking at RidersModule, Rider has 'user_id'.
    // I will update the service to accept userId and look up the rider, OR look it up here.
    // Service already looks up Rider by ID.

    // Let's rely on the service to find the rider by UserID if possible,
    // BUT the service method I wrote takes 'riderId'.
    // I will do a quick lookup in the controller if needed, or better, pass user ID to service?
    // Service: `riderRepository.findOne({ where: { id: riderId } })`

    // To be safe and clean:
    // Let's modify the service to findByUserId if we don't have riderId in token.
    // But for now, let's assume we can get it.
    // Checking codebase pattern... usually `req.user` might just be { userId, ... }

    // I'll update the logic to fetch rider by userId in the service for convenience
    // OR simply fetching it here. Fetching here is cleaner for the service (SRP).

    // Wait, the RiderFinanceService is in RidersModule. I can inject RidersService to finding rider.
    // But I can't inject RidersService into RiderFinanceService (circular? maybe not).

    // Let's assume for now I need to fetch the rider.
    // Actually, I'll update the Controller to inject RidersService to get the Rider ID.

    return this.riderFinanceService.getFinanceSummaryByUserId(
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
