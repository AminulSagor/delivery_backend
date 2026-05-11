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
import { InvoiceDetailsFlexQueryDto } from '../dto/invoice-details-flex-query.dto';
import { PaymentHistoryQueryDto } from '../dto/merchant-payment-dashboard.dto';
import { OrderwiseInvoiceQueryDto } from '../dto/orderwise-invoice-query.dto';
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

  // ===== PAYMENT DASHBOARD ENDPOINTS =====

  /**
   * Get merchant payment dashboard
   * Shows: Total Earning, Last Paid at, Available Balance
   * GET /merchant-invoices/payment-dashboard
   */
  @Get('payment-dashboard')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getMerchantPaymentDashboard(
    @Query('merchant_id') merchantId: string,
    @Req() req: any,
  ) {
    // If merchant role, use their own ID
    const targetMerchantId =
      req.user.role === UserRole.MERCHANT ? req.user.userId : merchantId;

    if (!targetMerchantId) {
      return {
        success: false,
        message: 'Merchant ID is required',
      };
    }

    const dashboard =
      await this.merchantInvoiceService.getMerchantPaymentDashboard(
        targetMerchantId,
      );

    return {
      success: true,
      data: dashboard,
      message: 'Merchant payment dashboard retrieved successfully',
    };
  }

  /**
   * Get merchant payment history with pagination and filtering
   * GET /merchant-invoices/payment-history
   */
  @Get('payment-history')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getMerchantPaymentHistory(
    @Query('merchant_id') merchantId: string,
    @Query() query: PaymentHistoryQueryDto,
    @Req() req: any,
  ) {
    // If merchant role, use their own ID
    const targetMerchantId =
      req.user.role === UserRole.MERCHANT ? req.user.userId : merchantId;

    if (!targetMerchantId) {
      return {
        success: false,
        message: 'Merchant ID is required',
      };
    }

    const history = await this.merchantInvoiceService.getMerchantPaymentHistory(
      targetMerchantId,
      {
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 10,
        from_date: query.from_date,
        to_date: query.to_date,
        status: query.status,
      },
    );

    return {
      success: true,
      data: history,
      message: 'Merchant payment history retrieved successfully',
    };
  }

  /**
   * Get admin view of all merchants' payment summary
   * Shows overview of merchant payments for admin
   * GET /merchant-invoices/admin/payment-summary
   */
  @Get('admin/payment-summary')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getAdminMerchantPaymentSummary(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('has_pending_balance') hasPendingBalance?: string,
  ) {
    const summary =
      await this.merchantInvoiceService.getAdminMerchantPaymentSummary({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        search,
        has_pending_balance: hasPendingBalance === 'true',
      });

    return {
      success: true,
      data: summary,
      message: 'Admin merchant payment summary retrieved successfully',
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
  async getMerchantSummary(
    @Query('merchant_id') merchantId: string,
    @Req() req: any,
  ) {
    // If merchant role, use their own ID
    const targetMerchantId =
      req.user.role === UserRole.MERCHANT ? req.user.userId : merchantId;

    if (!targetMerchantId) {
      return {
        success: false,
        message: 'Merchant ID is required',
      };
    }

    const summary =
      await this.merchantInvoiceService.getMerchantInvoiceSummary(
        targetMerchantId,
      );

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
  async getUnpaidByStore(
    @Query() query: UnpaidByStoreQueryDto,
    @Req() req: any,
  ) {
    // If merchant role, use their own ID
    const targetMerchantId =
      req.user.role === UserRole.MERCHANT ? req.user.userId : query.merchant_id;

    if (!targetMerchantId) {
      return {
        success: false,
        message: 'Merchant ID is required',
      };
    }

    const data =
      await this.merchantInvoiceService.getUnpaidParcelsByStore(
        targetMerchantId,
      );

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
  async getEligibleParcels(
    @Query('merchant_id') merchantId: string,
    @Req() req: any,
  ) {
    // If merchant role, use their own ID
    const targetMerchantId =
      req.user.role === UserRole.MERCHANT ? req.user.userId : merchantId;

    if (!targetMerchantId) {
      return {
        success: false,
        message: 'Merchant ID is required',
      };
    }

    const parcels =
      await this.merchantInvoiceService.getEligibleParcels(targetMerchantId);

    // Calculate breakdown for each parcel and enrich with customer & hub info
    const parcelBreakdowns = parcels.map((parcel) => {
      const breakdown =
        this.invoiceCalculationService.calculateParcelBreakdown(parcel);
      return {
        ...breakdown,
        merchant_name: parcel.merchant?.user?.full_name || 'N/A',
        merchant_phone: parcel.merchant?.user?.phone || 'N/A',
        customer_name: parcel.customer_name,
        customer_phone: parcel.customer_phone,
        customer_address: parcel.customer_address,
        special_instructions: parcel.special_instructions,
        hub_name: parcel.currentHub?.branch_name || 'N/A',
        delivery_charge_breakdown: {
          delivery_charge: Number(parcel.total_charge) || 0,
          return_charge: Number(parcel.return_charge) || 0,
          cod_charge: Number(parcel.cod_charge) || 0,
          total_charges:
            (Number(parcel.total_charge) || 0) +
            (Number(parcel.return_charge) || 0) +
            (Number(parcel.cod_charge) || 0),
        },
      };
    });

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
          estimated_payable: parcelBreakdowns.reduce(
            (sum, p) => sum + p.net_payable,
            0,
          ),
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

    if (this.shouldUseMerchantMockData(req)) {
      const data = this.buildMockInvoiceList(query, req.user.userId);
      return {
        success: true,
        data,
        message: 'Invoices retrieved successfully',
      };
    }

    const { invoices, total } =
      await this.merchantInvoiceService.getInvoices(query);

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
   * Get order-wise invoice list across all invoices
   * GET /merchant-invoices/orderwise
   */
  @Get('orderwise')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getOrderwiseInvoices(
    @Query() query: OrderwiseInvoiceQueryDto,
    @Req() req: any,
  ) {
    // If merchant role, always scope to their own invoices
    if (req.user.role === UserRole.MERCHANT) {
      query.merchant_id = req.user.userId;
    }

    const normalizedSortOrder = (query.sort_order || 'DESC').toUpperCase();
    const sortOrder =
      normalizedSortOrder === 'ASC' || normalizedSortOrder === 'DESC'
        ? normalizedSortOrder
        : 'DESC';

    const { orders, total, summary } =
      await this.merchantInvoiceService.getOrderwiseInvoices({
        merchant_id: query.merchant_id,
        invoice_status: query.invoice_status,
        order_status: query.order_status,
        from_date: query.from_date || query.fromDate,
        to_date: query.to_date || query.toDate,
        search: query.search,
        sort_by: query.sort_by || 'order_date',
        sort_order: sortOrder,
        page: query.page || 1,
        limit: query.limit || 10,
      });

    return {
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: query.page || 1,
          limit: query.limit || 10,
          totalPages: Math.ceil(total / (query.limit || 10)),
        },
        summary,
      },
      message: 'Order-wise invoices retrieved successfully',
    };
  }

  /**
   * Get invoice details (single or all)
   * GET /merchant-invoices/invoice-details
   *
   * - If `invoice_id` is provided, returns details for that invoice.
   * - If `invoice_id` is omitted, returns parcel-level details across all matching invoices.
   */
  @Get('invoice-details')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getInvoiceDetailsFlexible(
    @Query() query: InvoiceDetailsFlexQueryDto,
    @Req() req: any,
  ) {
    if (req.user.role === UserRole.MERCHANT) {
      query.merchant_id = req.user.userId;
    }

    if (this.shouldUseMerchantMockData(req)) {
      if (query.invoice_id) {
        const details = this.buildMockInvoiceDetails(
          query.invoice_id,
          query,
          req.user.userId,
        );

        return {
          success: true,
          data: details,
          message: 'Invoice details retrieved successfully',
        };
      }

      const data = this.buildMockInvoiceDetailsList(query, req.user.userId);

      return {
        success: true,
        data,
        message: 'All invoice details retrieved successfully',
      };
    }

    const normalizedSortOrder = (query.sort_order || 'DESC').toUpperCase();
    const sortOrder =
      normalizedSortOrder === 'ASC' || normalizedSortOrder === 'DESC'
        ? normalizedSortOrder
        : 'DESC';

    if (query.invoice_id) {
      const details = await this.merchantInvoiceService.getInvoiceDetails(
        query.invoice_id,
        {
          page: query.page,
          limit: query.limit,
          order_status: query.order_status,
          invoice_status: query.invoice_status,
          store_id: query.store_id,
          from_date: query.from_date || query.fromDate,
          to_date: query.to_date || query.toDate,
          sort_by: query.sort_by,
          sort_order: sortOrder,
        },
      );

      if (
        req.user.role === UserRole.MERCHANT &&
        details?.merchant?.id !== req.user.userId
      ) {
        return {
          success: false,
          message: 'Unauthorized access to this invoice',
        };
      }

      return {
        success: true,
        data: details,
        message: 'Invoice details retrieved successfully',
      };
    }

    const { invoice_details, total, summary } =
      await this.merchantInvoiceService.getAllInvoiceDetails({
        merchant_id: query.merchant_id,
        invoice_status: query.invoice_status,
        order_status: query.order_status,
        store_id: query.store_id,
        from_date: query.from_date || query.fromDate,
        to_date: query.to_date || query.toDate,
        search: query.search,
        sort_by: query.sort_by || 'order_date',
        sort_order: sortOrder,
        page: query.page || 1,
        limit: query.limit || 10,
      });

    return {
      success: true,
      data: {
        invoice_details,
        pagination: {
          total,
          page: query.page || 1,
          limit: query.limit || 10,
          totalPages: Math.ceil(total / (query.limit || 10)),
        },
        summary,
      },
      message: 'All invoice details retrieved successfully',
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
    if (this.shouldUseMerchantMockData(req)) {
      const details = this.buildMockInvoiceDetails(id, query, req.user.userId);

      return {
        success: true,
        data: details,
        message: 'Invoice details retrieved successfully',
      };
    }

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

  private shouldUseMerchantMockData(req: any): boolean {
    return (
      process.env.MOCK_MERCHANT_DATA === 'true' &&
      req?.user?.role === UserRole.MERCHANT
    );
  }

  private buildPagination(total: number, page: number, limit: number) {
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private buildMockInvoiceList(query: InvoiceQueryDto, merchantId: string) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const merchantName = merchantId
      ? `Demo Merchant ${merchantId.slice(0, 6)}`
      : 'Demo Merchant';
    const merchantPhone = '01700000000';
    const invoiceId1 = '2f1c7c2e-6d1d-4f63-9aa5-4b32f1b6a0a1';
    const invoiceId2 = '3e0b6f0e-4785-4bf4-98d5-cd9c6d8a3e74';
    const paymentMethodId = '7a6f3d2b-3c5f-4e2b-8d4b-16a0f81a9d21';

    const items = [
      {
        invoice_id: invoiceId1,
        invoice_no: 'MI060526A1B2',
        merchant_name: merchantName,
        merchant_phone: merchantPhone,
        total_parcels: 8,
        financial_breakdown: {
          collectable_amount: 12500,
          collected_amount: 12000,
          charges: {
            delivery_charge: 600,
            cod_charge: 200,
            weight_charge: 100,
            return_charge: 150,
            discount: 50,
            total_charges: 1000,
          },
        },
        payable_amount: 11000,
        payment_method: { id: paymentMethodId, method_type: 'BKASH' },
        invoice_status: 'UNPAID',
        created_at: new Date('2026-05-05T10:00:00.000Z'),
      },
      {
        invoice_id: invoiceId2,
        invoice_no: 'MI060526C3D4',
        merchant_name: merchantName,
        merchant_phone: merchantPhone,
        total_parcels: 5,
        financial_breakdown: {
          collectable_amount: 8200,
          collected_amount: 8000,
          charges: {
            delivery_charge: 400,
            cod_charge: 160,
            weight_charge: 80,
            return_charge: 0,
            discount: 0,
            total_charges: 640,
          },
        },
        payable_amount: 7360,
        payment_method: null,
        invoice_status: 'PAID',
        created_at: new Date('2026-05-03T09:00:00.000Z'),
      },
    ];

    let filtered = items;

    if (query.invoice_status) {
      filtered = filtered.filter(
        (item) => item.invoice_status === query.invoice_status,
      );
    }

    if (query.fromDate) {
      const fromDate = new Date(query.fromDate);
      filtered = filtered.filter((item) => item.created_at >= fromDate);
    }

    if (query.toDate) {
      const toDate = new Date(query.toDate);
      filtered = filtered.filter((item) => item.created_at <= toDate);
    }

    const total = filtered.length;
    const paged = filtered
      .slice((page - 1) * limit, page * limit)
      .map(({ invoice_status, created_at, ...rest }) => rest);

    return {
      invoices: paged,
      pagination: this.buildPagination(total, page, limit),
    };
  }

  private buildMockInvoiceDetailsList(
    query: InvoiceDetailsFlexQueryDto,
    merchantId: string,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const invoiceId1 = '2f1c7c2e-6d1d-4f63-9aa5-4b32f1b6a0a1';
    const invoiceId2 = '3e0b6f0e-4785-4bf4-98d5-cd9c6d8a3e74';
    const paymentMethodId = '7a6f3d2b-3c5f-4e2b-8d4b-16a0f81a9d21';

    const rows = [
      {
        invoice: {
          id: invoiceId1,
          invoice_no: 'MI060526A1B2',
          transaction_id: 'TXN-5C1A2B',
          status: 'UNPAID',
          invoice_date: new Date('2026-05-05T10:00:00.000Z'),
          paid_at: null,
          merchant_id: merchantId,
        },
        parcel: {
          parcel_id: '8d7a4d7a-5d1d-4cb2-9c76-0b2b68e2a1f1',
          parcel_tx_id: 'PTX-1001',
          tracking_number: 'TRK-1001',
          order_id: 'ORD-1001',
          order_date: new Date('2026-05-04T09:00:00.000Z'),
          order_status: 'DELIVERED',
          invoice_type: 'DELIVERY',
        },
        customer: {
          name: 'Rahim Uddin',
          phone: '01711111111',
          address: 'House 12, Dhanmondi, Dhaka',
        },
        store: {
          store_id: '5f8b4d2c-2d34-4e0d-8f5c-92c62c52f2b3',
          store_name: 'Gadget Hub',
          store_phone: '01720000000',
        },
        financial: {
          collectable_amount: 1200,
          collected_amount: 1200,
          delivery_fee: 60,
          cod_fee: 12,
          weight_charge: 20,
          total_fee: 90,
          return_charge: 0,
          receivable_amount: 1110,
          currency: 'BDT',
        },
        payment_method: { id: paymentMethodId, method_type: 'BKASH' },
      },
      {
        invoice: {
          id: invoiceId1,
          invoice_no: 'MI060526A1B2',
          transaction_id: 'TXN-5C1A2B',
          status: 'UNPAID',
          invoice_date: new Date('2026-05-05T10:00:00.000Z'),
          paid_at: null,
          merchant_id: merchantId,
        },
        parcel: {
          parcel_id: '2c7a9e4d-9e1b-4d9e-a832-32a2a14db79a',
          parcel_tx_id: 'PTX-1002',
          tracking_number: 'TRK-1002',
          order_id: 'ORD-1002',
          order_date: new Date('2026-05-04T11:30:00.000Z'),
          order_status: 'RETURNED',
          invoice_type: 'RETURN',
        },
        customer: {
          name: 'Sadia Akter',
          phone: '01722222222',
          address: 'Road 5, Uttara, Dhaka',
        },
        store: {
          store_id: '5f8b4d2c-2d34-4e0d-8f5c-92c62c52f2b3',
          store_name: 'Gadget Hub',
          store_phone: '01720000000',
        },
        financial: {
          collectable_amount: 800,
          collected_amount: 800,
          delivery_fee: 40,
          cod_fee: 8,
          weight_charge: 10,
          total_fee: 60,
          return_charge: 50,
          receivable_amount: 690,
          currency: 'BDT',
        },
        payment_method: { id: paymentMethodId, method_type: 'BKASH' },
      },
      {
        invoice: {
          id: invoiceId2,
          invoice_no: 'MI060526C3D4',
          transaction_id: 'TXN-7D9F11',
          status: 'PAID',
          invoice_date: new Date('2026-05-03T09:00:00.000Z'),
          paid_at: new Date('2026-05-04T08:30:00.000Z'),
          merchant_id: merchantId,
        },
        parcel: {
          parcel_id: 'b15446a6-0f6c-4b1f-8ec9-32d16417ad0e',
          parcel_tx_id: 'PTX-2001',
          tracking_number: 'TRK-2001',
          order_id: 'ORD-2001',
          order_date: new Date('2026-05-02T10:15:00.000Z'),
          order_status: 'DELIVERED',
          invoice_type: 'DELIVERY',
        },
        customer: {
          name: 'Mehedi Hasan',
          phone: '01733333333',
          address: 'Block C, Mirpur, Dhaka',
        },
        store: {
          store_id: 'a7a9d9c2-7c3f-4ab1-9e18-5a5d63b71a7f',
          store_name: 'Tech Park',
          store_phone: '01730000000',
        },
        financial: {
          collectable_amount: 1500,
          collected_amount: 1500,
          delivery_fee: 80,
          cod_fee: 15,
          weight_charge: 25,
          total_fee: 120,
          return_charge: 0,
          receivable_amount: 1380,
          currency: 'BDT',
        },
        payment_method: null,
      },
    ];

    let filtered = rows;

    if (query.invoice_status) {
      filtered = filtered.filter(
        (row) => row.invoice.status === query.invoice_status,
      );
    }

    if (query.order_status) {
      filtered = filtered.filter(
        (row) => row.parcel.order_status === query.order_status,
      );
    }

    if (query.store_id) {
      filtered = filtered.filter(
        (row) => row.store.store_id === query.store_id,
      );
    }

    if (query.search) {
      const search = query.search.toLowerCase();
      filtered = filtered.filter((row) =>
        [
          row.parcel.tracking_number,
          row.parcel.order_id,
          row.customer.phone,
          row.invoice.invoice_no,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(search)),
      );
    }

    const fromDateValue = query.from_date || query.fromDate;
    if (fromDateValue) {
      const fromDate = new Date(fromDateValue);
      filtered = filtered.filter((row) => row.parcel.order_date >= fromDate);
    }

    const toDateValue = query.to_date || query.toDate;
    if (toDateValue) {
      const toDate = new Date(toDateValue);
      filtered = filtered.filter((row) => row.parcel.order_date <= toDate);
    }

    const total = filtered.length;
    const paged = filtered.slice((page - 1) * limit, page * limit);

    const summary = {
      total_orders: total,
      total_invoices: new Set(filtered.map((row) => row.invoice.id)).size,
      total_collected_amount: filtered.reduce(
        (sum, row) => sum + row.financial.collected_amount,
        0,
      ),
      total_fee: filtered.reduce(
        (sum, row) => sum + row.financial.total_fee,
        0,
      ),
      total_return_charge: filtered.reduce(
        (sum, row) => sum + row.financial.return_charge,
        0,
      ),
      total_receivable: filtered.reduce(
        (sum, row) => sum + row.financial.receivable_amount,
        0,
      ),
    };

    return {
      invoice_details: paged,
      pagination: this.buildPagination(total, page, limit),
      summary,
    };
  }

  private buildMockInvoiceDetails(
    invoiceId: string,
    query: InvoiceDetailsQueryDto | InvoiceDetailsFlexQueryDto,
    merchantId: string,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const merchantName = 'Demo Merchant';
    const merchantPhone = '01700000000';
    const profileId = '4b3d6a5e-2af0-4d69-8d3f-49f1f2b0d66c';
    const paymentMethodId = 'd94e0a9b-8369-43f8-9e8a-29f4d6f4f8f2';

    const invoiceMeta = {
      id: invoiceId,
      invoice_no:
        invoiceId === '3e0b6f0e-4785-4bf4-98d5-cd9c6d8a3e74'
          ? 'MI060526C3D4'
          : 'MI060526A1B2',
      transaction_id: 'TXN-5C1A2B',
      date: new Date('2026-05-05T10:00:00.000Z'),
      status: 'UNPAID',
      paid_at: null,
      payment_reference: null,
      notes: null,
      created_at: new Date('2026-05-05T10:00:00.000Z'),
      updated_at: new Date('2026-05-05T12:30:00.000Z'),
    };

    const baseParcels = [
      {
        parcel_id: '8d7a4d7a-5d1d-4cb2-9c76-0b2b68e2a1f1',
        parcel_tx_id: 'PTX-1001',
        tracking_number: 'TRK-1001',
        order_id: 'ORD-1001',
        order_date: new Date('2026-05-04T09:00:00.000Z'),
        status: 'DELIVERED',
        customer_id: '0c3b975f-0c55-4a47-9821-0fdbb9f6a02e',
        customer_name: 'Rahim Uddin',
        customer_phone: '01711111111',
        customer_address: 'House 12, Dhanmondi, Dhaka',
        store_id: '5f8b4d2c-2d34-4e0d-8f5c-92c62c52f2b3',
        store_name: 'Gadget Hub',
        store_phone: '01720000000',
        collectable_amount: 1200,
        collected_amount: 1200,
        delivery_fee: 60,
        cod_fee: 12,
        weight_charge: 20,
        total_fee: 90,
        return_charge: 0,
      },
      {
        parcel_id: '2c7a9e4d-9e1b-4d9e-a832-32a2a14db79a',
        parcel_tx_id: 'PTX-1002',
        tracking_number: 'TRK-1002',
        order_id: 'ORD-1002',
        order_date: new Date('2026-05-04T11:30:00.000Z'),
        status: 'RETURNED',
        customer_id: '9e7b5b6e-5a7c-4d2e-8d4f-2fb3c9d8e5cb',
        customer_name: 'Sadia Akter',
        customer_phone: '01722222222',
        customer_address: 'Road 5, Uttara, Dhaka',
        store_id: '5f8b4d2c-2d34-4e0d-8f5c-92c62c52f2b3',
        store_name: 'Gadget Hub',
        store_phone: '01720000000',
        collectable_amount: 800,
        collected_amount: 800,
        delivery_fee: 40,
        cod_fee: 8,
        weight_charge: 10,
        total_fee: 60,
        return_charge: 50,
      },
      {
        parcel_id: 'b15446a6-0f6c-4b1f-8ec9-32d16417ad0e',
        parcel_tx_id: 'PTX-2001',
        tracking_number: 'TRK-2001',
        order_id: 'ORD-2001',
        order_date: new Date('2026-05-02T10:15:00.000Z'),
        status: 'PARTIAL_DELIVERY',
        customer_id: '9e0f8c4c-7284-4e3d-8e8f-33d1b3da9cf7',
        customer_name: 'Mehedi Hasan',
        customer_phone: '01733333333',
        customer_address: 'Block C, Mirpur, Dhaka',
        store_id: 'a7a9d9c2-7c3f-4ab1-9e18-5a5d63b71a7f',
        store_name: 'Tech Park',
        store_phone: '01730000000',
        collectable_amount: 1500,
        collected_amount: 1300,
        delivery_fee: 70,
        cod_fee: 15,
        weight_charge: 25,
        total_fee: 110,
        return_charge: 0,
      },
    ];

    let filteredParcels = baseParcels;

    if (query.order_status) {
      filteredParcels = filteredParcels.filter(
        (parcel) => parcel.status === query.order_status,
      );
    }

    if (query.store_id) {
      filteredParcels = filteredParcels.filter(
        (parcel) => parcel.store_id === query.store_id,
      );
    }

    const queryAny = query as InvoiceDetailsFlexQueryDto;
    const fromDateValue = queryAny.from_date || queryAny.fromDate;
    if (fromDateValue) {
      const fromDate = new Date(fromDateValue);
      filteredParcels = filteredParcels.filter(
        (parcel) => parcel.order_date >= fromDate,
      );
    }

    const toDateValue = queryAny.to_date || queryAny.toDate;
    if (toDateValue) {
      const toDate = new Date(toDateValue);
      filteredParcels = filteredParcels.filter(
        (parcel) => parcel.order_date <= toDate,
      );
    }

    const returnedStatuses = new Set([
      'RETURNED',
      'PAID_RETURN',
      'RETURNED_TO_HUB',
      'RETURN_TO_MERCHANT',
    ]);

    const parcelDetails = filteredParcels.map((parcel) => {
      const calculatedTotal =
        parcel.delivery_fee + parcel.cod_fee + parcel.weight_charge;
      const discount =
        calculatedTotal > parcel.total_fee
          ? calculatedTotal - parcel.total_fee
          : 0;
      const receivableAmount =
        parcel.collected_amount - parcel.total_fee - parcel.return_charge;

      return {
        parcel_info: {
          parcel_id: parcel.parcel_id,
          parcel_tx_id: parcel.parcel_tx_id,
          tracking_number: parcel.tracking_number,
          order_id: parcel.order_id,
          order_date: parcel.order_date,
        },
        customer_info: {
          customer_id: parcel.customer_id,
          customer_name: parcel.customer_name,
          customer_phone: parcel.customer_phone,
          customer_address: parcel.customer_address,
        },
        store_info: {
          store_id: parcel.store_id,
          store_name: parcel.store_name,
          store_phone: parcel.store_phone,
        },
        financial_info: {
          receivable_amount: receivableAmount,
          currency: 'BDT',
          breakdown: {
            collectable_amount: parcel.collectable_amount,
            collected_amount: parcel.collected_amount,
            delivery_fee: parcel.delivery_fee,
            cod_fee: parcel.cod_fee,
            weight_charge: parcel.weight_charge,
            discount: discount > 0 ? -discount : 0,
            total_fee: parcel.total_fee,
            return_charge: parcel.return_charge,
          },
        },
        status_info: {
          order_status: parcel.status,
          invoice_type: returnedStatuses.has(parcel.status)
            ? 'RETURN'
            : 'DELIVERY',
          invoice_status: invoiceMeta.status,
        },
      };
    });

    const totalParcels = filteredParcels.length;
    const pagedParcels = parcelDetails.slice((page - 1) * limit, page * limit);

    const allCollected = baseParcels.reduce(
      (sum, parcel) => sum + parcel.collected_amount,
      0,
    );
    const allDeliveryCharges = baseParcels.reduce(
      (sum, parcel) => sum + parcel.total_fee,
      0,
    );
    const allReturnCharges = baseParcels.reduce(
      (sum, parcel) => sum + parcel.return_charge,
      0,
    );

    const deliveredStatuses = new Set([
      'DELIVERED',
      'PARTIAL_DELIVERY',
      'EXCHANGE',
    ]);

    const summary = {
      total_parcels: baseParcels.length,
      delivered_count: baseParcels.filter((p) =>
        deliveredStatuses.has(p.status),
      ).length,
      partial_delivery_count: baseParcels.filter(
        (p) => p.status === 'PARTIAL_DELIVERY',
      ).length,
      returned_count: baseParcels.filter((p) => p.status === 'RETURNED').length,
      paid_return_count: baseParcels.filter((p) => p.status === 'PAID_RETURN')
        .length,
      total_cod_amount: baseParcels.reduce(
        (sum, parcel) => sum + parcel.collectable_amount,
        0,
      ),
      total_cod_collected: allCollected,
      total_delivery_charges: allDeliveryCharges,
      total_return_charges: allReturnCharges,
      payable_amount: allCollected - allDeliveryCharges - allReturnCharges,
    };

    return {
      invoice: invoiceMeta,
      merchant: {
        id: merchantId,
        profile_id: profileId,
        name: merchantName,
        phone: merchantPhone,
      },
      payment_method: {
        id: paymentMethodId,
        method_type: 'BANK_ACCOUNT',
        details: {
          bank_name: 'Sonali Bank',
          branch_name: 'Dhanmondi',
          account_holder_name: merchantName,
          account_number: '1234567890',
          routing_number: '010000001',
        },
      },
      summary,
      parcels: pagedParcels,
      pagination: this.buildPagination(totalParcels, page, limit),
    };
  }
}
