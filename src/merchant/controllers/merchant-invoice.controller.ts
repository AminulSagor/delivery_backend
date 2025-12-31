import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MerchantInvoiceService } from '../services/merchant-invoice.service';
import { InvoiceCalculationService } from '../services/invoice-calculation.service';
import { GenerateInvoiceDto } from '../dto/generate-invoice.dto';
import { PayInvoiceDto } from '../dto/pay-invoice.dto';
import { InvoiceQueryDto } from '../dto/invoice-query.dto';
import { UnpaidByStoreQueryDto } from '../dto/unpaid-by-store-query.dto';
import { UpdateInvoiceStatusDto } from '../dto/update-invoice-status.dto';
import { InvoiceDetailsQueryDto } from '../dto/invoice-details-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('merchant-invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MerchantInvoiceController {
  constructor(
    private readonly merchantInvoiceService: MerchantInvoiceService,
    private readonly invoiceCalculationService: InvoiceCalculationService,
  ) {}

  // ===== ADMIN ENDPOINTS =====

  /**
   * Get merchant invoice eligibility list
   * Shows merchants with unpaid parcels (paid_to_merchant = false) across entire lifespan
   * Combines Delivered + Returned parcels as Total Parcel
   * Includes: Total Parcel, Parcel Delivered, Parcel Returned, Total Transaction, Merchant Address
   * GET /merchant-invoices/merchant-eligibility-list
   */
  @Get('merchant-eligibility-list')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getMerchantInvoiceEligibilityList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('merchant_id') merchantId?: string,
    @Query('search') search?: string,
  ) {
    const { merchants, total, summary } =
      await this.merchantInvoiceService.getMerchantInvoiceEligibilityList({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        merchantId,
        search,
      });

    return {
      success: true,
      data: {
        merchants,
        pagination: {
          total,
          page: page ? parseInt(page, 10) : 1,
          limit: limit ? parseInt(limit, 10) : 10,
          totalPages: Math.ceil(total / (limit ? parseInt(limit, 10) : 10)),
        },
        summary,
      },
      message: 'Merchant invoice eligibility list retrieved successfully',
    };
  }

  /**
   * Get all unpaid parcels list (parcel-level view)
   * Shows individual parcels with paid_to_merchant = false
   * Includes: parcel details, merchant info, customer, hub, charges breakdown
   * GET /merchant-invoices/unpaid-parcels-list
   */
  @Get('unpaid-parcels-list')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getUnpaidParcelsList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('merchant_id') merchantId?: string,
    @Query('hub_id') hubId?: string,
    @Query('search') search?: string,
  ) {
    const { parcels, total, summary } =
      await this.merchantInvoiceService.getUnpaidParcelsList({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        status,
        merchantId,
        hubId,
        search,
      });

    return {
      success: true,
      data: {
        parcels,
        pagination: {
          total,
          page: page ? parseInt(page, 10) : 1,
          limit: limit ? parseInt(limit, 10) : 10,
          totalPages: Math.ceil(total / (limit ? parseInt(limit, 10) : 10)),
        },
        summary,
      },
      message: 'Unpaid parcels list retrieved successfully',
    };
  }

  /**
   * Get pending invoices list
   * Shows all unpaid/processing invoices with full details
   * Includes: Transaction ID, Date, Total Parcel, Total Amount, Status, Invoice ID,
   * Merchant (Name, Number), Payable Amount, Payment Method
   * GET /merchant-invoices/pending-list
   */
  @Get('pending-list')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getPendingInvoicesList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('merchant_id') merchantId?: string,
    @Query('search') search?: string,
  ) {
    const { invoices, total, summary } =
      await this.merchantInvoiceService.getPendingInvoicesList({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        merchantId,
        search,
      });

    return {
      success: true,
      data: {
        invoices,
        pagination: {
          total,
          page: page ? parseInt(page, 10) : 1,
          limit: limit ? parseInt(limit, 10) : 10,
          totalPages: Math.ceil(total / (limit ? parseInt(limit, 10) : 10)),
        },
        summary,
      },
      message: 'Pending invoices list retrieved successfully',
    };
  }

  // ===== MERCHANT ENDPOINTS =====

  /**
   * Get comprehensive merchant invoice summary
   * Includes: merchant info, parcel stats, transaction stats, financial summary
   * GET /merchant-invoices/summary
   */
  @Get('summary')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getMerchantSummary(@Query('merchant_id') merchantId: string, @Req() req: any) {
    // If merchant role, use their own ID
    const targetMerchantId =
      req.user.role === UserRole.MERCHANT ? req.user.userId : merchantId;

    if (!targetMerchantId) {
      return {
        success: false,
        message: 'Merchant ID is required',
      };
    }

    const summary = await this.merchantInvoiceService.getMerchantInvoiceSummary(targetMerchantId);

    return {
      success: true,
      data: summary,
      message: 'Merchant invoice summary retrieved successfully',
    };
  }

  /**
   * Export pending invoices to Excel
   * GET /merchant-invoices/export/pending
   */
  @Get('export/pending')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async exportPendingInvoices(@Res() res: Response) {
    const buffer = await this.merchantInvoiceService.exportPendingInvoices();

    const fileName = `pending-invoices-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  }

  /**
   * Get unpaid parcels grouped by store
   * GET /merchant-invoices/unpaid-by-store
   */
  @Get('unpaid-by-store')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getUnpaidByStore(@Query() query: UnpaidByStoreQueryDto, @Req() req: any) {
    // If merchant role, use their own ID
    const targetMerchantId =
      req.user.role === UserRole.MERCHANT ? req.user.userId : query.merchant_id;

    if (!targetMerchantId) {
      return {
        success: false,
        message: 'Merchant ID is required',
      };
    }

    const data = await this.merchantInvoiceService.getUnpaidParcelsByStore(targetMerchantId);

    return {
      success: true,
      data,
      message: 'Unpaid parcels by store retrieved successfully',
    };
  }

  /**
   * Get eligible parcels for invoice generation
   * GET /merchant-invoices/eligible-parcels
   */
  @Get('eligible-parcels')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getEligibleParcels(@Query('merchant_id') merchantId: string, @Req() req: any) {
    // If merchant role, use their own ID
    const targetMerchantId =
      req.user.role === UserRole.MERCHANT ? req.user.userId : merchantId;

    if (!targetMerchantId) {
      return {
        success: false,
        message: 'Merchant ID is required',
      };
    }

    const parcels = await this.merchantInvoiceService.getEligibleParcels(targetMerchantId);

    // Calculate breakdown for each parcel
    const parcelBreakdowns = parcels.map((parcel) =>
      this.invoiceCalculationService.calculateParcelBreakdown(parcel),
    );

    return {
      success: true,
      data: {
        merchant_id: targetMerchantId,
        eligible_parcels: parcelBreakdowns,
        total_count: parcelBreakdowns.length,
        summary: {
          total_cod_collected: parcelBreakdowns.reduce(
            (sum, p) => sum + p.cod_collected,
            0,
          ),
          total_delivery_charges: parcelBreakdowns
            .filter((p) => p.delivery_charge_applicable)
            .reduce((sum, p) => sum + p.delivery_charge, 0),
          total_return_charges: parcelBreakdowns
            .filter((p) => p.return_charge_applicable)
            .reduce((sum, p) => sum + p.return_charge, 0),
          estimated_payable: parcelBreakdowns.reduce((sum, p) => sum + p.net_payable, 0),
        },
      },
      message: 'Eligible parcels retrieved successfully',
    };
  }

  /**
   * Generate merchant invoice
   * POST /merchant-invoices
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async generateInvoice(@Body() dto: GenerateInvoiceDto) {
    const result = await this.merchantInvoiceService.generateInvoice(dto);

    return {
      success: true,
      data: {
        invoice: result.invoice,
        breakdown: result.breakdown,
      },
      message: 'Invoice generated successfully',
    };
  }

  /**
   * Get invoice list
   * GET /merchant-invoices
   */
  @Get()
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getInvoices(@Query() query: InvoiceQueryDto, @Req() req: any) {
    // If merchant role, filter by their own ID
    if (req.user.role === UserRole.MERCHANT) {
      query.merchant_id = req.user.userId;
    }

    const { invoices, total } = await this.merchantInvoiceService.getInvoices(query);

    return {
      success: true,
      data: {
        invoices,
        pagination: {
          total,
          page: query.page || 1,
          limit: query.limit || 10,
          totalPages: Math.ceil(total / (query.limit || 10)),
        },
      },
      message: 'Invoices retrieved successfully',
    };
  }

  /**
   * Get invoice details with parcel list
   * Supports pagination, filtering, and sorting
   * GET /merchant-invoices/:id
   * 
   * Query params:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 10)
   * - order_status: Filter by parcel status (DELIVERED, RETURNED, etc.)
   * - store_id: Filter by store
   * - from_date: Filter from date
   * - to_date: Filter to date
   * - sort_by: Sort field (order_date, receivable_amount)
   * - sort_order: Sort direction (ASC, DESC)
   */
  @Get(':id')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getInvoiceDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: InvoiceDetailsQueryDto,
    @Req() req: any,
  ) {
    const details = await this.merchantInvoiceService.getInvoiceDetails(id, {
      page: query.page,
      limit: query.limit,
      order_status: query.order_status,
      invoice_status: query.invoice_status,
      store_id: query.store_id,
      from_date: query.from_date,
      to_date: query.to_date,
      sort_by: query.sort_by,
      sort_order: query.sort_order,
    });

    // If merchant, verify they own this invoice
    if (req.user.role === UserRole.MERCHANT) {
      if (details.invoice.merchant_id !== req.user.userId) {
        return {
          success: false,
          message: 'Unauthorized access to this invoice',
        };
      }
    }

    return {
      success: true,
      data: details,
      message: 'Invoice details retrieved successfully',
    };
  }

  /**
   * Update invoice status (Admin only)
   * PATCH /merchant-invoices/:id/status
   */
  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateInvoiceStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceStatusDto,
  ) {
    const invoice = await this.merchantInvoiceService.updateInvoiceStatus(
      id,
      dto.invoice_status,
    );

    return {
      success: true,
      data: { invoice },
      message: 'Invoice status updated successfully',
    };
  }

  /**
   * Mark invoice as paid (Admin only)
   * POST /merchant-invoices/:id/pay
   */
  @Post(':id/pay')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async markInvoiceAsPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayInvoiceDto,
    @Req() req: any,
  ) {
    const invoice = await this.merchantInvoiceService.markInvoiceAsPaid(
      id,
      req.user.userId,
      dto,
    );

    return {
      success: true,
      data: { invoice },
      message: 'Invoice marked as paid successfully',
    };
  }
}

