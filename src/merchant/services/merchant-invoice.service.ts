import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Not } from 'typeorm';
import { MerchantInvoice, InvoiceStatus } from '../entities/merchant-invoice.entity';
import { Parcel, ParcelStatus } from '../../parcels/entities/parcel.entity';
import { Merchant } from '../entities/merchant.entity';
import { User } from '../../users/entities/user.entity';
import { MerchantPayoutMethod } from '../entities/merchant-payout-method.entity';
import { FinancialStatus } from '../../common/enums/financial-status.enum';
import { InvoiceCalculationService } from './invoice-calculation.service';
import { GenerateInvoiceDto } from '../dto/generate-invoice.dto';
import { PayInvoiceDto } from '../dto/pay-invoice.dto';
import { InvoiceQueryDto } from '../dto/invoice-query.dto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class MerchantInvoiceService {
  private readonly logger = new Logger(MerchantInvoiceService.name);

  constructor(
    @InjectRepository(MerchantInvoice)
    private merchantInvoiceRepository: Repository<MerchantInvoice>,
    @InjectRepository(Parcel)
    private parcelRepository: Repository<Parcel>,
    @InjectRepository(Merchant)
    private merchantRepository: Repository<Merchant>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(MerchantPayoutMethod)
    private payoutMethodRepository: Repository<MerchantPayoutMethod>,
    private invoiceCalculationService: InvoiceCalculationService,
  ) {}

  /**
   * Get eligible parcels for invoice generation
   * Parcels that are:
   * - In a terminal delivery status (DELIVERED, PARTIAL_DELIVERY, RETURNED, etc.)
   * - Not yet invoiced
   * - Have money to pay or charges to collect
   */
  async getEligibleParcels(merchantId: string): Promise<Parcel[]> {
    // Terminal statuses that are eligible for invoicing
    const terminalStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.RETURNED,
      ParcelStatus.RETURNED_TO_HUB,
      ParcelStatus.RETURN_TO_MERCHANT,
    ];

    const parcels = await this.parcelRepository.find({
      where: {
        merchant_id: merchantId,
        invoice_id: IsNull(), // NOT already invoiced
        paid_to_merchant: false,
        financial_status: FinancialStatus.PENDING,
        status: In(terminalStatuses), // Only terminal statuses
      },
      relations: ['store', 'delivery_coverage_area'],
      order: {
        delivered_at: 'DESC',
      },
    });

    // Filter parcels that have money to pay OR charges to collect
    return parcels.filter((parcel) => {
      const codCollected = Number(parcel.cod_collected_amount) || 0;
      const hasDeliveryCharge = parcel.delivery_charge_applicable;
      const hasReturnCharge = parcel.return_charge_applicable;

      return codCollected > 0 || hasDeliveryCharge || hasReturnCharge;
    });
  }

  /**
   * Get comprehensive merchant invoice summary with merchant info
   */
  async getMerchantInvoiceSummary(userId: string): Promise<any> {
    // Get user info
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get merchant profile
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: userId },
    });

    // Terminal statuses for counting
    const deliveredStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
    ];

    const returnedStatuses = [
      ParcelStatus.RETURNED,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.RETURNED_TO_HUB,
      ParcelStatus.RETURN_TO_MERCHANT,
    ];

    // Count total parcels by merchant
    const totalParcels = await this.parcelRepository.count({
      where: { merchant_id: userId },
    });

    // Count delivered parcels
    const deliveredParcels = await this.parcelRepository.count({
      where: {
        merchant_id: userId,
        status: In(deliveredStatuses),
      },
    });

    // Count returned parcels
    const returnedParcels = await this.parcelRepository.count({
      where: {
        merchant_id: userId,
        status: In(returnedStatuses),
      },
    });

    // Count pending parcels (in transit)
    const pendingParcels = totalParcels - deliveredParcels - returnedParcels;

    // Get all invoices for this merchant
    const invoices = await this.merchantInvoiceRepository.find({
      where: { merchant_id: userId },
    });

    const totalInvoices = invoices.length;
    const paidInvoices = invoices.filter(inv => inv.invoice_status === InvoiceStatus.PAID).length;
    const unpaidInvoices = invoices.filter(inv => inv.invoice_status === InvoiceStatus.UNPAID).length;
    const processingInvoices = invoices.filter(inv => inv.invoice_status === InvoiceStatus.PROCESSING).length;

    // Calculate total amounts
    const totalCodCollected = invoices.reduce((sum, inv) => sum + Number(inv.total_cod_collected), 0);
    const totalDeliveryCharges = invoices.reduce((sum, inv) => sum + Number(inv.total_delivery_charges), 0);
    const totalReturnCharges = invoices.reduce((sum, inv) => sum + Number(inv.total_return_charges), 0);
    const totalPayable = invoices.reduce((sum, inv) => sum + Number(inv.payable_amount), 0);
    const totalPaid = invoices
      .filter(inv => inv.invoice_status === InvoiceStatus.PAID)
      .reduce((sum, inv) => sum + Number(inv.payable_amount), 0);
    const totalPending = totalPayable - totalPaid;

    // Get eligible parcels for new invoice
    const eligibleParcels = await this.getEligibleParcels(userId);
    const eligibleBreakdowns = eligibleParcels.map((parcel) =>
      this.invoiceCalculationService.calculateParcelBreakdown(parcel),
    );

    return {
      // Merchant Info
      merchant: {
        id: merchant?.id || null,
        user_id: user.id,
        name: user.full_name,
        phone: user.phone,
        email: user.email,
        status: user.is_active ? 'ACTIVE' : 'INACTIVE',
        merchant_status: merchant?.status || 'N/A',
        address: {
          full_address: merchant?.full_address || null,
          thana: merchant?.thana || null,
          district: merchant?.district || null,
        },
        secondary_number: merchant?.secondary_number || null,
        created_at: user.created_at,
      },

      // Parcel Statistics
      parcel_stats: {
        total_parcels: totalParcels,
        delivered_parcels: deliveredParcels,
        returned_parcels: returnedParcels,
        pending_parcels: pendingParcels,
        delivery_rate: totalParcels > 0 
          ? Math.round((deliveredParcels / totalParcels) * 100 * 100) / 100 
          : 0,
        return_rate: totalParcels > 0 
          ? Math.round((returnedParcels / totalParcels) * 100 * 100) / 100 
          : 0,
      },

      // Invoice/Transaction Statistics
      transaction_stats: {
        total_invoices: totalInvoices,
        paid_invoices: paidInvoices,
        unpaid_invoices: unpaidInvoices,
        processing_invoices: processingInvoices,
      },

      // Financial Summary
      financial_summary: {
        total_cod_collected: totalCodCollected,
        total_delivery_charges: totalDeliveryCharges,
        total_return_charges: totalReturnCharges,
        total_payable: totalPayable,
        total_paid: totalPaid,
        total_pending: totalPending,
      },

      // Eligible Parcels for New Invoice
      eligible_for_invoice: {
        parcels: eligibleBreakdowns,
        count: eligibleBreakdowns.length,
        summary: {
          total_cod_collected: eligibleBreakdowns.reduce((sum, p) => sum + p.cod_collected, 0),
          total_delivery_charges: eligibleBreakdowns
            .filter((p) => p.delivery_charge_applicable)
            .reduce((sum, p) => sum + p.delivery_charge, 0),
          total_return_charges: eligibleBreakdowns
            .filter((p) => p.return_charge_applicable)
            .reduce((sum, p) => sum + p.return_charge, 0),
          estimated_payable: eligibleBreakdowns.reduce((sum, p) => sum + p.net_payable, 0),
        },
      },
    };
  }

  /**
   * Generate invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    // Get count of invoices this month
    const count = await this.merchantInvoiceRepository.count({
      where: {
        invoice_no: In([`INV-${year}-${month}%`]),
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `INV-${year}-${month}-${sequence}`;
  }

  /**
   * Generate transaction ID
   */
  private async generateTransactionId(): Promise<string> {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TXN-${timestamp}-${random}`;
  }

  /**
   * Generate merchant invoice
   * Admin can pass only parcel_ids - merchant is auto-detected
   * All parcels must belong to the same merchant
   */
  async generateInvoice(
    dto: GenerateInvoiceDto,
  ): Promise<{ invoice: MerchantInvoice; breakdown: any }> {
    // First, fetch all parcels by IDs
    const parcels = await this.parcelRepository.find({
      where: {
        id: In(dto.parcel_ids),
      },
      relations: ['store', 'delivery_coverage_area'],
    });

    // Check if all parcels were found
    if (parcels.length !== dto.parcel_ids.length) {
      const foundIds = parcels.map((p) => p.id);
      const missingIds = dto.parcel_ids.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Some parcels not found: ${missingIds.join(', ')}`,
      );
    }

    // Get unique merchant IDs from parcels
    const merchantIds = [...new Set(parcels.map((p) => p.merchant_id))];

    // Validate all parcels belong to the same merchant
    if (merchantIds.length > 1) {
      throw new BadRequestException(
        'All parcels must belong to the same merchant. Selected parcels belong to multiple merchants.',
      );
    }

    // Auto-detect merchant_id from parcels (or use provided one)
    const merchantId = dto.merchant_id || merchantIds[0];

    // If merchant_id was provided, validate it matches the parcels
    if (dto.merchant_id && dto.merchant_id !== merchantIds[0]) {
      throw new BadRequestException(
        'Provided merchant_id does not match the merchant of the selected parcels',
      );
    }

    // Validate parcels are eligible (not already invoiced or paid)
    const ineligible = parcels.filter(
      (p) => p.invoice_id !== null || p.paid_to_merchant === true,
    );

    if (ineligible.length > 0) {
      throw new BadRequestException(
        `Parcels already invoiced or paid: ${ineligible.map((p) => p.tracking_number).join(', ')}`,
      );
    }

    // Get merchant profile to get merchant_profile_id
    const merchantProfile = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    // Get merchant's default payment method
    const defaultPayoutMethod = await this.payoutMethodRepository.findOne({
      where: {
        merchant_id: merchantProfile?.id || merchantId,
        is_default: true,
      },
    });

    // Calculate totals
    const totals = this.invoiceCalculationService.calculateInvoiceTotals(parcels);

    // Start transaction
    const queryRunner = this.parcelRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate invoice number and transaction ID
      const invoiceNo = await this.generateInvoiceNumber();
      const transactionId = await this.generateTransactionId();

      // Create invoice
      const invoice = queryRunner.manager.create(MerchantInvoice, {
        invoice_no: invoiceNo,
        transaction_id: transactionId,
        merchant_id: merchantId,
        merchant_profile_id: merchantProfile?.id || null,
        payout_method_id: defaultPayoutMethod?.id || null,
        total_parcels: totals.total_parcels,
        delivered_count: totals.delivered_count,
        partial_delivery_count: totals.partial_delivery_count,
        returned_count: totals.returned_count,
        paid_return_count: totals.paid_return_count,
        total_cod_amount: totals.total_cod_amount,
        total_cod_collected: totals.total_cod_collected,
        total_delivery_charges: totals.total_delivery_charges,
        total_return_charges: totals.total_return_charges,
        payable_amount: totals.payable_amount,
        invoice_status: InvoiceStatus.UNPAID,
      });

      const savedInvoice = await queryRunner.manager.save(MerchantInvoice, invoice);

      // Update parcels
      await queryRunner.manager.update(
        Parcel,
        { id: In(dto.parcel_ids) },
        {
          invoice_id: savedInvoice.id,
          financial_status: FinancialStatus.INVOICED,
        },
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `Invoice ${invoiceNo} (${transactionId}) generated for merchant ${merchantId} with ${totals.total_parcels} parcels`,
      );

      return {
        invoice: savedInvoice,
        breakdown: totals,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to generate invoice: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get invoice list
   */
  async getInvoices(
    query: InvoiceQueryDto,
  ): Promise<{ invoices: MerchantInvoice[]; total: number }> {
    const { merchant_id, invoice_status, fromDate, toDate, page = 1, limit = 10 } = query;

    const queryBuilder = this.merchantInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.merchant', 'merchant')
      .leftJoinAndSelect('invoice.paidByUser', 'paidByUser');

    if (merchant_id) {
      queryBuilder.andWhere('invoice.merchant_id = :merchant_id', { merchant_id });
    }

    if (invoice_status) {
      queryBuilder.andWhere('invoice.invoice_status = :invoice_status', {
        invoice_status,
      });
    }

    if (fromDate) {
      queryBuilder.andWhere('invoice.created_at >= :fromDate', { fromDate });
    }

    if (toDate) {
      queryBuilder.andWhere('invoice.created_at <= :toDate', { toDate });
    }

    queryBuilder
      .orderBy('invoice.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [invoices, total] = await queryBuilder.getManyAndCount();

    return { invoices, total };
  }

  /**
   * Get invoice details with parcel list
   * Supports pagination, filtering, and sorting
   */
  async getInvoiceDetails(
    invoiceId: string,
    query?: {
      page?: number;
      limit?: number;
      order_status?: string;
      invoice_status?: string;
      store_id?: string;
      from_date?: string;
      to_date?: string;
      sort_by?: 'order_date' | 'receivable_amount';
      sort_order?: 'ASC' | 'DESC';
    },
  ): Promise<any> {
    const {
      page = 1,
      limit = 10,
      order_status,
      store_id,
      from_date,
      to_date,
      sort_by = 'order_date',
      sort_order = 'DESC',
    } = query || {};

    // Get invoice with relations
    const invoice = await this.merchantInvoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['merchant', 'paidByUser', 'merchantProfile', 'merchantProfile.user', 'payoutMethod'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Build query for parcels
    const parcelQueryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'delivery_coverage_area')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .where('parcel.invoice_id = :invoiceId', { invoiceId });

    // Apply filters
    if (order_status) {
      parcelQueryBuilder.andWhere('parcel.status = :order_status', { order_status });
    }

    if (store_id) {
      parcelQueryBuilder.andWhere('parcel.store_id = :store_id', { store_id });
    }

    if (from_date) {
      parcelQueryBuilder.andWhere('parcel.created_at >= :from_date', { from_date });
    }

    if (to_date) {
      parcelQueryBuilder.andWhere('parcel.created_at <= :to_date', { to_date });
    }

    // Apply sorting
    if (sort_by === 'order_date') {
      parcelQueryBuilder.orderBy('parcel.created_at', sort_order);
    } else if (sort_by === 'receivable_amount') {
      // Sort by calculated receivable amount (cod_collected - total_charge - return_charge)
      parcelQueryBuilder.orderBy(
        'COALESCE(parcel.cod_collected_amount, 0) - COALESCE(parcel.total_charge, 0) - CASE WHEN parcel.return_charge_applicable = true THEN COALESCE(parcel.return_charge, 0) ELSE 0 END',
        sort_order,
      );
    }

    // Get total count before pagination
    const totalParcels = await parcelQueryBuilder.getCount();

    // Apply pagination
    parcelQueryBuilder.skip((page - 1) * limit).take(limit);

    const parcels = await parcelQueryBuilder.getMany();

    // Get merchant info
    const merchantName =
      invoice.merchantProfile?.user?.full_name ||
      invoice.merchant?.full_name ||
      'N/A';
    const merchantPhone =
      invoice.merchantProfile?.user?.phone ||
      invoice.merchant?.phone ||
      'N/A';

    // Determine invoice type based on parcel statuses
    const deliveredStatuses = ['DELIVERED', 'PARTIAL_DELIVERY', 'EXCHANGE'];
    const returnedStatuses = ['RETURNED', 'PAID_RETURN', 'RETURNED_TO_HUB', 'RETURN_TO_MERCHANT'];

    // Build detailed parcel list
    const parcelDetails = parcels.map((parcel) => {
      // Calculate amounts
      const collectableAmount = Number(parcel.cod_amount) || 0;
      const collectedAmount = Number(parcel.cod_collected_amount) || 0;
      const deliveryFee = Number(parcel.delivery_charge) || 0;
      const codFee = Number(parcel.cod_charge) || 0;
      const weightCharge = Number(parcel.weight_charge) || 0;
      const totalCharge = Number(parcel.total_charge) || 0;
      const returnCharge = parcel.return_charge_applicable
        ? Number(parcel.return_charge) || 0
        : 0;

      // Calculate discount (if total_charge is less than sum of individual charges)
      const calculatedTotal = deliveryFee + codFee + weightCharge;
      const discount = calculatedTotal > totalCharge ? calculatedTotal - totalCharge : 0;

      // Store receivable = Collected - Total Fee - Return Charge
      const receivableAmount = collectedAmount - totalCharge - returnCharge;

      // Determine invoice type (Delivery or Return)
      let invoiceType = 'DELIVERY';
      if (returnedStatuses.includes(parcel.status)) {
        invoiceType = 'RETURN';
      }

      return {
        // Parcel Information
        parcel_info: {
          parcel_id: parcel.id,
          tracking_number: parcel.tracking_number,
          order_id: parcel.merchant_order_id,
          order_date: parcel.created_at,
        },

        // Customer Information
        customer_info: {
          customer_id: parcel.customer_id,
          customer_name: parcel.customer_name,
          customer_phone: parcel.customer_phone,
          delivery_address: parcel.delivery_address,
        },

        // Store Information
        store_info: {
          store_id: parcel.store_id,
          store_name: parcel.store?.business_name || 'N/A',
          store_phone: parcel.store?.phone_number || 'N/A',
        },

        // Financial Information - Store Receivable Amount
        financial_info: {
          receivable_amount: receivableAmount,
          currency: 'BDT',
          breakdown: {
            collectable_amount: collectableAmount,
            collected_amount: collectedAmount,
            delivery_fee: deliveryFee,
            cod_fee: codFee,
            weight_charge: weightCharge,
            discount: discount > 0 ? -discount : 0,
            total_fee: totalCharge,
            return_charge: returnCharge,
          },
        },

        // Status Information
        status_info: {
          order_status: parcel.status,
          invoice_type: invoiceType,
          invoice_status: invoice.invoice_status,
        },
      };
    });

    // Payment method details
    let paymentMethodInfo: any = null;
    if (invoice.payoutMethod) {
      paymentMethodInfo = {
        id: invoice.payoutMethod.id,
        method_type: invoice.payoutMethod.method_type,
        details: this.getPaymentMethodDetails(invoice.payoutMethod),
      };
    }

    // Calculate invoice summary from ALL parcels (not just current page)
    const allParcels = await this.parcelRepository.find({
      where: { invoice_id: invoiceId },
    });

    const totalCollectedAmount = allParcels.reduce(
      (sum, p) => sum + (Number(p.cod_collected_amount) || 0),
      0,
    );
    const totalDeliveryCharges = allParcels.reduce(
      (sum, p) => sum + (Number(p.total_charge) || 0),
      0,
    );
    const totalReturnCharges = allParcels.reduce(
      (sum, p) =>
        sum + (p.return_charge_applicable ? Number(p.return_charge) || 0 : 0),
      0,
    );

    return {
      // Invoice Header
      invoice: {
        id: invoice.id,
        invoice_no: invoice.invoice_no,
        transaction_id: invoice.transaction_id,
        date: invoice.created_at,
        status: invoice.invoice_status,
        paid_at: invoice.paid_at,
        payment_reference: invoice.payment_reference,
        notes: invoice.notes,
      },

      // Merchant Info
      merchant: {
        id: invoice.merchant_id,
        profile_id: invoice.merchant_profile_id,
        name: merchantName,
        phone: merchantPhone,
      },

      // Payment Method
      payment_method: paymentMethodInfo,

      // Invoice Summary
      summary: {
        total_parcels: invoice.total_parcels,
        delivered_count: invoice.delivered_count,
        partial_delivery_count: invoice.partial_delivery_count,
        returned_count: invoice.returned_count,
        paid_return_count: invoice.paid_return_count,
        total_cod_amount: Number(invoice.total_cod_amount),
        total_cod_collected: totalCollectedAmount,
        total_delivery_charges: totalDeliveryCharges,
        total_return_charges: totalReturnCharges,
        payable_amount: Number(invoice.payable_amount),
      },

      // Parcels with pagination
      parcels: parcelDetails,
      pagination: {
        total: totalParcels,
        page,
        limit,
        totalPages: Math.ceil(totalParcels / limit),
      },
    };
  }

  /**
   * Mark invoice as paid
   */
  async markInvoiceAsPaid(
    invoiceId: string,
    adminUserId: string,
    dto: PayInvoiceDto,
  ): Promise<MerchantInvoice> {
    const invoice = await this.merchantInvoiceRepository.findOne({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.invoice_status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already paid');
    }

    // Start transaction
    const queryRunner = this.parcelRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update invoice status
      invoice.invoice_status = InvoiceStatus.PAID;
      invoice.paid_at = new Date();
      invoice.paid_by = adminUserId;
      invoice.payment_reference = dto.payment_reference || null;
      invoice.notes = dto.notes || null;

      await queryRunner.manager.save(MerchantInvoice, invoice);

      // Get all parcels in this invoice
      const parcels = await queryRunner.manager.find(Parcel, {
        where: { invoice_id: invoiceId },
      });

      // Mark each parcel as paid
      for (const parcel of parcels) {
        const payableAmount = this.invoiceCalculationService.calculateParcelPayable(parcel);

        await queryRunner.manager.update(
          Parcel,
          { id: parcel.id },
          {
            paid_to_merchant: true,
            paid_to_merchant_at: new Date(),
            paid_amount: payableAmount,
            financial_status: FinancialStatus.PAID,
          },
        );
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Invoice ${invoice.invoice_no} marked as paid by admin ${adminUserId}`,
      );

      return invoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to mark invoice as paid: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(
    invoiceId: string,
    status: InvoiceStatus,
  ): Promise<MerchantInvoice> {
    const invoice = await this.merchantInvoiceRepository.findOne({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.invoice_status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot change status of paid invoice');
    }

    invoice.invoice_status = status;
    await this.merchantInvoiceRepository.save(invoice);

    this.logger.log(`Invoice ${invoice.invoice_no} status changed to ${status}`);

    return invoice;
  }

  /**
   * Export pending invoices to Excel
   */
  async exportPendingInvoices(): Promise<Buffer> {
    // Get all pending invoices (UNPAID + PROCESSING)
    const pendingInvoices = await this.merchantInvoiceRepository.find({
      where: [
        { invoice_status: InvoiceStatus.UNPAID },
        { invoice_status: InvoiceStatus.PROCESSING },
      ],
      relations: ['merchant'],
      order: {
        created_at: 'DESC',
      },
    });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pending Invoices');

    // Define columns
    worksheet.columns = [
      { header: 'Invoice No', key: 'invoice_no', width: 20 },
      { header: 'Merchant Name', key: 'merchant_name', width: 30 },
      { header: 'Merchant Phone', key: 'merchant_phone', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Total Parcels', key: 'total_parcels', width: 15 },
      { header: 'Delivered', key: 'delivered_count', width: 12 },
      { header: 'Returned', key: 'returned_count', width: 12 },
      { header: 'COD Collected', key: 'cod_collected', width: 18 },
      { header: 'Delivery Charges', key: 'delivery_charges', width: 18 },
      { header: 'Return Charges', key: 'return_charges', width: 18 },
      { header: 'Payable Amount', key: 'payable_amount', width: 18 },
      { header: 'Created Date', key: 'created_at', width: 20 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data rows
    pendingInvoices.forEach((invoice) => {
      const row = worksheet.addRow({
        invoice_no: invoice.invoice_no,
        merchant_name: invoice.merchant?.full_name || 'N/A',
        merchant_phone: invoice.merchant?.phone || 'N/A',
        status: invoice.invoice_status,
        total_parcels: invoice.total_parcels,
        delivered_count: invoice.delivered_count,
        returned_count: invoice.returned_count,
        cod_collected: Number(invoice.total_cod_collected),
        delivery_charges: Number(invoice.total_delivery_charges),
        return_charges: Number(invoice.total_return_charges),
        payable_amount: Number(invoice.payable_amount),
        created_at: invoice.created_at.toISOString().split('T')[0],
      });

      // Format currency columns
      row.getCell('cod_collected').numFmt = '৳#,##0.00';
      row.getCell('delivery_charges').numFmt = '৳#,##0.00';
      row.getCell('return_charges').numFmt = '৳#,##0.00';
      row.getCell('payable_amount').numFmt = '৳#,##0.00';

      // Color code status
      const statusCell = row.getCell('status');
      if (invoice.invoice_status === InvoiceStatus.UNPAID) {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEBEE' }, // Light red
        };
        statusCell.font = { color: { argb: 'FFD32F2F' } }; // Dark red
      } else if (invoice.invoice_status === InvoiceStatus.PROCESSING) {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF3E0' }, // Light orange
        };
        statusCell.font = { color: { argb: 'FFF57C00' } }; // Dark orange
      }
    });

    // Add summary row
    const summaryRowNum = worksheet.rowCount + 2;
    worksheet.getRow(summaryRowNum).font = { bold: true, size: 12 };
    worksheet.getCell(`A${summaryRowNum}`).value = 'TOTAL:';
    worksheet.getCell(`E${summaryRowNum}`).value = pendingInvoices.reduce(
      (sum, inv) => sum + inv.total_parcels,
      0,
    );
    worksheet.getCell(`H${summaryRowNum}`).value = pendingInvoices.reduce(
      (sum, inv) => sum + Number(inv.total_cod_collected),
      0,
    );
    worksheet.getCell(`I${summaryRowNum}`).value = pendingInvoices.reduce(
      (sum, inv) => sum + Number(inv.total_delivery_charges),
      0,
    );
    worksheet.getCell(`J${summaryRowNum}`).value = pendingInvoices.reduce(
      (sum, inv) => sum + Number(inv.total_return_charges),
      0,
    );
    worksheet.getCell(`K${summaryRowNum}`).value = pendingInvoices.reduce(
      (sum, inv) => sum + Number(inv.payable_amount),
      0,
    );

    // Format summary row
    worksheet.getCell(`H${summaryRowNum}`).numFmt = '৳#,##0.00';
    worksheet.getCell(`I${summaryRowNum}`).numFmt = '৳#,##0.00';
    worksheet.getCell(`J${summaryRowNum}`).numFmt = '৳#,##0.00';
    worksheet.getCell(`K${summaryRowNum}`).numFmt = '৳#,##0.00';

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Get unpaid parcels grouped by store
   */
  async getUnpaidParcelsByStore(merchantId: string): Promise<any> {
    // Terminal statuses that are eligible for invoicing
    const terminalStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.RETURNED,
      ParcelStatus.RETURNED_TO_HUB,
      ParcelStatus.RETURN_TO_MERCHANT,
    ];

    // Get all unpaid parcels for the merchant
    const unpaidParcels = await this.parcelRepository.find({
      where: {
        merchant_id: merchantId,
        invoice_id: IsNull(),
        paid_to_merchant: false,
        financial_status: FinancialStatus.PENDING,
        status: In(terminalStatuses), // Only terminal statuses
      },
      relations: ['store', 'merchant'],
      order: {
        delivered_at: 'DESC',
      },
    });

    // Filter parcels that have money to pay or charges to collect
    const eligibleParcels = unpaidParcels.filter((parcel) => {
      const codCollected = Number(parcel.cod_collected_amount) || 0;
      const hasDeliveryCharge = parcel.delivery_charge_applicable;
      const hasReturnCharge = parcel.return_charge_applicable;
      return codCollected > 0 || hasDeliveryCharge || hasReturnCharge;
    });

    // Group parcels by store
    const storeMap = new Map<string, any>();

    eligibleParcels.forEach((parcel) => {
      const storeId = parcel.store_id || 'no-store';
      
      if (!storeMap.has(storeId)) {
        storeMap.set(storeId, {
          store_id: storeId === 'no-store' ? null : storeId,
          store_name: parcel.store?.business_name || 'Unknown Store',
          store_phone: parcel.store?.phone_number || 'N/A',
          parcels: [],
          delivered_count: 0,
          partial_delivery_count: 0,
          returned_count: 0,
          paid_return_count: 0,
          total_cod_collected: 0,
          total_delivery_charges: 0,
          total_return_charges: 0,
          due_amount: 0,
          last_payment_date: null,
        });
      }

      const store = storeMap.get(storeId);
      store.parcels.push(parcel);

      // Count by status
      if (parcel.status === 'DELIVERED') store.delivered_count++;
      if (parcel.status === 'PARTIAL_DELIVERY') store.partial_delivery_count++;
      if (parcel.status === 'RETURNED') store.returned_count++;
      if (parcel.status === 'PAID_RETURN') store.paid_return_count++;

      // Sum amounts
      const codCollected = Number(parcel.cod_collected_amount) || 0;
      store.total_cod_collected += codCollected;

      if (parcel.delivery_charge_applicable) {
        store.total_delivery_charges += Number(parcel.total_charge) || 0;
      }

      if (parcel.return_charge_applicable) {
        store.total_return_charges += Number(parcel.return_charge) || 0;
      }

      // Update last payment date
      if (parcel.delivered_at) {
        if (!store.last_payment_date || parcel.delivered_at > store.last_payment_date) {
          store.last_payment_date = parcel.delivered_at;
        }
      }
    });

    // Calculate due amount for each store and prepare response
    const stores = Array.from(storeMap.values()).map((store) => {
      store.due_amount = 
        store.total_cod_collected - 
        store.total_delivery_charges - 
        store.total_return_charges;
      
      store.total_unpaid_parcels = store.parcels.length;
      delete store.parcels; // Remove parcel details, only keep summary
      
      return store;
    });

    // Calculate overall summary
    const summary = {
      total_stores: stores.length,
      total_unpaid_parcels: eligibleParcels.length,
      total_collected: stores.reduce((sum, s) => sum + s.total_cod_collected, 0),
      total_delivery_charges: stores.reduce((sum, s) => sum + s.total_delivery_charges, 0),
      total_return_charges: stores.reduce((sum, s) => sum + s.total_return_charges, 0),
      total_due: stores.reduce((sum, s) => sum + s.due_amount, 0),
    };

    // Get merchant info
    const merchantInfo = eligibleParcels[0]?.merchant || null;

    return {
      merchant_id: merchantId,
      merchant_name: merchantInfo?.full_name || 'Unknown Merchant',
      stores: stores.sort((a, b) => a.store_name.localeCompare(b.store_name)),
      summary,
    };
  }

  /**
   * Get merchant invoice eligibility list
   * Shows merchants with unpaid parcels (paid_to_merchant = false) across their entire lifespan
   * Combines delivered and returned parcels as total
   * Similar to admin/merchants/clearance-list but with more details
   */
  async getMerchantInvoiceEligibilityList(query: {
    page?: number;
    limit?: number;
    merchantId?: string;
    search?: string;
  }): Promise<{
    merchants: any[];
    total: number;
    summary: any;
  }> {
    const { page = 1, limit = 10, merchantId, search } = query;

    // Build where clause - only unpaid parcels
    const whereClause: any = { paid_to_merchant: false };
    if (merchantId) {
      whereClause.merchant_id = merchantId;
    }

    // Get ALL unpaid parcels (entire lifespan)
    const unpaidParcels = await this.parcelRepository.find({
      where: whereClause,
    });

    // Group parcels by merchant_id
    const parcelsByMerchant = new Map<string, typeof unpaidParcels>();
    for (const parcel of unpaidParcels) {
      const mid = parcel.merchant_id;
      if (!parcelsByMerchant.has(mid)) {
        parcelsByMerchant.set(mid, []);
      }
      parcelsByMerchant.get(mid)!.push(parcel);
    }

    // Get all unique merchant IDs
    const merchantIds = Array.from(parcelsByMerchant.keys());

    // Fetch Merchant entities with User relation to get name, phone, and address
    const merchants = await this.merchantRepository.find({
      where: merchantIds.map((id) => ({ id })),
      relations: ['user'],
    });

    // Create a map of merchant_id -> Merchant (with User)
    const merchantInfoMap = new Map<string, Merchant>();
    for (const merchant of merchants) {
      merchantInfoMap.set(merchant.id, merchant);
    }

    // Define delivered and returned statuses
    const deliveredStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
    ];

    const returnedStatuses = [
      ParcelStatus.RETURNED,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.RETURNED_TO_HUB,
      ParcelStatus.RETURN_TO_MERCHANT,
    ];

    // Build the eligibility list with proper merchant info
    let merchantMap = new Map<
      string,
      {
        merchant_id: string;
        merchant_name: string;
        phone_number: string;
        merchant_address: string;
        parcels: typeof unpaidParcels;
      }
    >();

    for (const [mid, parcels] of parcelsByMerchant.entries()) {
      const merchant = merchantInfoMap.get(mid);
      const fullAddress = merchant
        ? [merchant.full_address, merchant.thana, merchant.district]
            .filter(Boolean)
            .join(', ')
        : 'N/A';

      merchantMap.set(mid, {
        merchant_id: mid,
        merchant_name: merchant?.user?.full_name || 'N/A',
        phone_number: merchant?.user?.phone || 'N/A',
        merchant_address: fullAddress,
        parcels,
      });
    }

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      const filteredMap = new Map<
        string,
        (typeof merchantMap extends Map<string, infer V> ? V : never)
      >();
      for (const [mid, data] of merchantMap.entries()) {
        if (
          data.merchant_name.toLowerCase().includes(searchLower) ||
          data.phone_number.toLowerCase().includes(searchLower) ||
          data.merchant_address.toLowerCase().includes(searchLower)
        ) {
          filteredMap.set(mid, data);
        }
      }
      merchantMap = filteredMap;
    }

    // Calculate stats for each merchant
    const merchantEligibilityList = Array.from(merchantMap.entries()).map(
      ([, data]) => {
        const parcels = data.parcels;

        // Count delivered parcels
        const deliveredParcels = parcels.filter((p) =>
          deliveredStatuses.includes(p.status as ParcelStatus),
        );

        // Count returned parcels
        const returnedParcels = parcels.filter((p) =>
          returnedStatuses.includes(p.status as ParcelStatus),
        );

        // Total parcel = Delivered + Returned
        const totalParcel = deliveredParcels.length + returnedParcels.length;

        // Calculate totals
        const totalCollectedAmount = parcels.reduce(
          (sum, p) => sum + Number(p.cod_collected_amount || p.cod_amount || 0),
          0,
        );

        const totalDeliveryCharge = parcels.reduce(
          (sum, p) => sum + Number(p.delivery_charge || 0),
          0,
        );

        const totalReturnCharge = parcels.reduce(
          (sum, p) => sum + Number(p.return_charge || 0),
          0,
        );

        // Total Transaction = Total COD Collected
        const totalTransaction = totalCollectedAmount;

        // Due amount = COD Collected - Delivery Charge - Return Charge
        const dueAmount =
          totalCollectedAmount - totalDeliveryCharge - totalReturnCharge;

        return {
          merchant_id: data.merchant_id,
          merchant_name: data.merchant_name,
          phone_number: data.phone_number,
          merchant_address: data.merchant_address,
          total_parcel: totalParcel, // Delivered + Returned
          parcel_delivered: deliveredParcels.length,
          parcel_returned: returnedParcels.length,
          total_transaction: totalTransaction,
          total_collected_amount: totalCollectedAmount,
          total_delivery_charge: totalDeliveryCharge,
          total_return_charge: totalReturnCharge,
          total_due_amount: dueAmount,
        };
      },
    );

    // Apply pagination
    const total = merchantEligibilityList.length;
    const paginatedList = merchantEligibilityList.slice(
      (page - 1) * limit,
      page * limit,
    );

    // Calculate grand totals for summary
    const grandTotals = merchantEligibilityList.reduce(
      (acc, m) => ({
        total_merchants: acc.total_merchants + 1,
        total_parcel: acc.total_parcel + m.total_parcel,
        total_delivered: acc.total_delivered + m.parcel_delivered,
        total_returned: acc.total_returned + m.parcel_returned,
        total_transaction: acc.total_transaction + m.total_transaction,
        total_collected_amount:
          acc.total_collected_amount + m.total_collected_amount,
        total_delivery_charge:
          acc.total_delivery_charge + m.total_delivery_charge,
        total_return_charge: acc.total_return_charge + m.total_return_charge,
        total_due_amount: acc.total_due_amount + m.total_due_amount,
      }),
      {
        total_merchants: 0,
        total_parcel: 0,
        total_delivered: 0,
        total_returned: 0,
        total_transaction: 0,
        total_collected_amount: 0,
        total_delivery_charge: 0,
        total_return_charge: 0,
        total_due_amount: 0,
      },
    );

    return {
      merchants: paginatedList,
      total,
      summary: grandTotals,
    };
  }

  /**
   * Get all unpaid parcels list (parcel-level view)
   * Shows individual parcels with paid_to_merchant = false
   * Includes: parcel details, merchant info, customer, hub, charges breakdown
   */
  async getUnpaidParcelsList(query: {
    page?: number;
    limit?: number;
    status?: string;
    merchantId?: string;
    hubId?: string;
    search?: string;
  }): Promise<{
    parcels: any[];
    total: number;
    summary: any;
  }> {
    const { page = 1, limit = 10, status, merchantId, hubId, search } = query;

    // Build query builder for unpaid parcels
    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.currentHub', 'currentHub')
      .leftJoinAndSelect('parcel.originHub', 'originHub')
      .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
      .where('parcel.paid_to_merchant = :paidToMerchant', {
        paidToMerchant: false,
      });

    // Apply filters
    if (status) {
      queryBuilder.andWhere('parcel.status = :status', { status });
    }

    if (merchantId) {
      queryBuilder.andWhere('parcel.merchant_id = :merchantId', { merchantId });
    }

    if (hubId) {
      queryBuilder.andWhere(
        '(parcel.current_hub_id = :hubId OR parcel.origin_hub_id = :hubId OR parcel.destination_hub_id = :hubId)',
        { hubId },
      );
    }

    if (search) {
      queryBuilder.andWhere(
        '(parcel.tracking_number ILIKE :search OR parcel.customer_name ILIKE :search OR parcel.customer_phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Get total count before pagination
    const totalCount = await queryBuilder.getCount();

    // Apply pagination and ordering
    queryBuilder
      .orderBy('parcel.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const parcels = await queryBuilder.getMany();

    // Get merchant IDs from parcels
    const merchantIds = [...new Set(parcels.map((p) => p.merchant_id))];

    // Fetch Merchant entities with User relation
    const merchants = await this.merchantRepository.find({
      where: merchantIds.map((id) => ({ id })),
      relations: ['user'],
    });

    // Create merchant info map
    const merchantInfoMap = new Map<
      string,
      { name: string; phone: string }
    >();
    for (const merchant of merchants) {
      merchantInfoMap.set(merchant.id, {
        name: merchant?.user?.full_name || 'N/A',
        phone: merchant?.user?.phone || 'N/A',
      });
    }

    // Transform parcels to response format
    const parcelsList = parcels.map((parcel) => {
      const merchantInfo = merchantInfoMap.get(parcel.merchant_id) || {
        name: 'N/A',
        phone: 'N/A',
      };

      const collectedAmount = Number(parcel.cod_collected_amount) || 0;
      const deliveryCharge = Number(parcel.delivery_charge) || 0;
      const codCharge = Number(parcel.cod_charge) || 0;
      const weightCharge = Number(parcel.weight_charge) || 0;
      const totalCharge = Number(parcel.total_charge) || 0;
      const returnCharge = parcel.return_charge_applicable
        ? Number(parcel.return_charge) || 0
        : 0;

      // Payable = Collected Amount - Total Charge - Return Charge
      const payable = collectedAmount - totalCharge - returnCharge;

      // Determine which hub to show (current > destination > origin)
      const hub = parcel.currentHub || parcel.destinationHub || parcel.originHub;

      return {
        parcel_id: parcel.id,
        tracking_number: parcel.tracking_number,
        merchant: {
          id: parcel.merchant_id,
          name: merchantInfo.name,
          phone: merchantInfo.phone,
        },
        merchant_invoice_id: parcel.invoice_id || null,
        additional_note: parcel.special_instructions || parcel.admin_notes || null,
        customer: {
          id: parcel.customer_id || null,
          name: parcel.customer_name,
          phone: parcel.customer_phone,
          address: parcel.delivery_address,
        },
        hub: hub
          ? {
              id: hub.id,
              name: hub.branch_name,
              hub_code: hub.hub_code,
            }
          : null,
        status: parcel.status,
        collected_amount: collectedAmount,
        charge: {
          total: totalCharge,
          breakdown: {
            delivery_charge: deliveryCharge,
            cod_charge: codCharge,
            weight_charge: weightCharge,
          },
        },
        return_charge: returnCharge,
        payable: payable,
        delivered_at: parcel.delivered_at,
        created_at: parcel.created_at,
      };
    });

    // Calculate summary for ALL unpaid parcels (not just current page)
    const allUnpaidParcels = await this.parcelRepository.find({
      where: { paid_to_merchant: false },
    });

    const summary = {
      total_parcels: totalCount,
      total_collected_amount: allUnpaidParcels.reduce(
        (sum, p) => sum + (Number(p.cod_collected_amount) || 0),
        0,
      ),
      total_charge: allUnpaidParcels.reduce(
        (sum, p) => sum + (Number(p.total_charge) || 0),
        0,
      ),
      total_delivery_charge: allUnpaidParcels.reduce(
        (sum, p) => sum + (Number(p.delivery_charge) || 0),
        0,
      ),
      total_cod_charge: allUnpaidParcels.reduce(
        (sum, p) => sum + (Number(p.cod_charge) || 0),
        0,
      ),
      total_weight_charge: allUnpaidParcels.reduce(
        (sum, p) => sum + (Number(p.weight_charge) || 0),
        0,
      ),
      total_return_charge: allUnpaidParcels.reduce(
        (sum, p) =>
          sum + (p.return_charge_applicable ? Number(p.return_charge) || 0 : 0),
        0,
      ),
      total_payable: allUnpaidParcels.reduce((sum, p) => {
        const collected = Number(p.cod_collected_amount) || 0;
        const charge = Number(p.total_charge) || 0;
        const returnCh = p.return_charge_applicable
          ? Number(p.return_charge) || 0
          : 0;
        return sum + (collected - charge - returnCh);
      }, 0),
    };

    return {
      parcels: parcelsList,
      total: totalCount,
      summary,
    };
  }

  /**
   * Get pending invoices list
   * Shows all unpaid/processing invoices with full details
   * Includes: Transaction ID, Date, Total Parcel, Total Amount, Status, Invoice ID,
   * Merchant (Name, Number), Payable Amount, Payment Method
   */
  async getPendingInvoicesList(query: {
    page?: number;
    limit?: number;
    merchantId?: string;
    search?: string;
  }): Promise<{
    invoices: any[];
    total: number;
    summary: any;
  }> {
    const { page = 1, limit = 10, merchantId, search } = query;

    // Build query for pending invoices (UNPAID or PROCESSING)
    const queryBuilder = this.merchantInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.merchant', 'merchant')
      .leftJoinAndSelect('invoice.merchantProfile', 'merchantProfile')
      .leftJoinAndSelect('merchantProfile.user', 'merchantUser')
      .leftJoinAndSelect('invoice.payoutMethod', 'payoutMethod')
      .where('invoice.invoice_status IN (:...statuses)', {
        statuses: [InvoiceStatus.UNPAID, InvoiceStatus.PROCESSING],
      });

    // Apply filters
    if (merchantId) {
      queryBuilder.andWhere('invoice.merchant_id = :merchantId', { merchantId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(invoice.invoice_no ILIKE :search OR invoice.transaction_id ILIKE :search OR merchant.full_name ILIKE :search OR merchant.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Get total count before pagination
    const totalCount = await queryBuilder.getCount();

    // Apply pagination and ordering
    queryBuilder
      .orderBy('invoice.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const invoices = await queryBuilder.getMany();

    // Transform invoices to response format
    const invoicesList = invoices.map((invoice) => {
      // Get payment method details
      let paymentMethodInfo: any = null;
      if (invoice.payoutMethod) {
        const pm = invoice.payoutMethod;
        paymentMethodInfo = {
          id: pm.id,
          method_type: pm.method_type,
          is_default: pm.is_default,
          details: this.getPaymentMethodDetails(pm),
        };
      }

      // Get merchant info from merchantProfile or merchant user
      const merchantName =
        invoice.merchantProfile?.user?.full_name ||
        invoice.merchant?.full_name ||
        'N/A';
      const merchantPhone =
        invoice.merchantProfile?.user?.phone ||
        invoice.merchant?.phone ||
        'N/A';

      return {
        invoice_id: invoice.id,
        invoice_no: invoice.invoice_no,
        transaction_id: invoice.transaction_id || invoice.invoice_no,
        date: invoice.created_at,
        merchant: {
          id: invoice.merchant_id,
          profile_id: invoice.merchant_profile_id,
          name: merchantName,
          phone: merchantPhone,
        },
        total_parcel: invoice.total_parcels,
        total_amount: Number(invoice.total_cod_collected),
        status: invoice.invoice_status,
        payable_amount: Number(invoice.payable_amount),
        payment_method: paymentMethodInfo,
        breakdown: {
          total_cod_amount: Number(invoice.total_cod_amount),
          total_cod_collected: Number(invoice.total_cod_collected),
          total_delivery_charges: Number(invoice.total_delivery_charges),
          total_return_charges: Number(invoice.total_return_charges),
          delivered_count: invoice.delivered_count,
          partial_delivery_count: invoice.partial_delivery_count,
          returned_count: invoice.returned_count,
          paid_return_count: invoice.paid_return_count,
        },
      };
    });

    // Calculate summary for ALL pending invoices
    const allPendingInvoices = await this.merchantInvoiceRepository.find({
      where: {
        invoice_status: In([InvoiceStatus.UNPAID, InvoiceStatus.PROCESSING]),
      },
    });

    const summary = {
      total_invoices: totalCount,
      total_unpaid: allPendingInvoices.filter(
        (i) => i.invoice_status === InvoiceStatus.UNPAID,
      ).length,
      total_processing: allPendingInvoices.filter(
        (i) => i.invoice_status === InvoiceStatus.PROCESSING,
      ).length,
      total_parcels: allPendingInvoices.reduce(
        (sum, i) => sum + i.total_parcels,
        0,
      ),
      total_collected_amount: allPendingInvoices.reduce(
        (sum, i) => sum + Number(i.total_cod_collected),
        0,
      ),
      total_delivery_charges: allPendingInvoices.reduce(
        (sum, i) => sum + Number(i.total_delivery_charges),
        0,
      ),
      total_return_charges: allPendingInvoices.reduce(
        (sum, i) => sum + Number(i.total_return_charges),
        0,
      ),
      total_payable: allPendingInvoices.reduce(
        (sum, i) => sum + Number(i.payable_amount),
        0,
      ),
    };

    return {
      invoices: invoicesList,
      total: totalCount,
      summary,
    };
  }

  /**
   * Helper method to get payment method details based on type
   */
  private getPaymentMethodDetails(payoutMethod: MerchantPayoutMethod): any {
    switch (payoutMethod.method_type) {
      case 'BANK_ACCOUNT':
        return {
          bank_name: payoutMethod.bank_name,
          branch_name: payoutMethod.branch_name,
          account_holder_name: payoutMethod.account_holder_name,
          account_number: payoutMethod.account_number,
          routing_number: payoutMethod.routing_number,
        };
      case 'BKASH':
        return {
          bkash_number: payoutMethod.bkash_number,
          bkash_account_holder_name: payoutMethod.bkash_account_holder_name,
          bkash_account_type: payoutMethod.bkash_account_type,
        };
      case 'NAGAD':
        return {
          nagad_number: payoutMethod.nagad_number,
          nagad_account_holder_name: payoutMethod.nagad_account_holder_name,
          nagad_account_type: payoutMethod.nagad_account_type,
        };
      case 'CASH':
        return { type: 'CASH' };
      default:
        return null;
    }
  }
}

