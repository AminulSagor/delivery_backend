import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');

const COLORS = {
  orange: '#F15A24',
  navy: '#172033',
  muted: '#6B7280',
  border: '#D9DEE7',
  soft: '#F5F7FA',
  white: '#FFFFFF',
};

@Injectable()
export class InvoicePdfService {
  async generate(details: any): Promise<Buffer> {
    const document = new PDFDocument({
      size: 'A4',
      margin: 36,
      compress: true,
      bufferPages: true,
      info: {
        Title: `Merchant Invoice ${details.invoice.invoice_no}`,
        Author: 'Meghswar Courier',
        Subject: 'Merchant financial invoice',
      },
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });

    this.drawHeader(document, details);
    this.drawInvoiceInformation(document, details);
    this.drawSummary(document, details.summary);
    this.drawParcelTable(document, details.parcels || []);
    this.drawPaymentInformation(document, details);

    const range = document.bufferedPageRange();
    for (let index = 0; index < range.count; index++) {
      document.switchToPage(index);
      document
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(
          `Meghswar Courier  |  Invoice ${details.invoice.invoice_no}  |  Page ${index + 1} of ${range.count}`,
          36,
          806,
          { width: 523, align: 'center', lineBreak: false },
        );
    }

    document.end();
    return completed;
  }

  private drawHeader(document: PDFKit.PDFDocument, details: any): void {
    document
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor(COLORS.orange)
      .text('MEGHSWAR COURIER', 36, 36);
    document
      .fontSize(18)
      .fillColor(COLORS.navy)
      .text('MERCHANT INVOICE', 350, 38, { width: 209, align: 'right' });
    document
      .moveTo(36, 70)
      .lineTo(559, 70)
      .lineWidth(2)
      .strokeColor(COLORS.orange)
      .stroke();
    document.y = 84;
  }

  private drawInvoiceInformation(
    document: PDFKit.PDFDocument,
    details: any,
  ): void {
    const invoice = details.invoice;
    const merchant = details.merchant;
    const leftX = 44;
    const rightX = 310;
    const top = document.y;

    document
      .roundedRect(36, top, 523, 92, 5)
      .fillAndStroke(COLORS.soft, COLORS.border);
    this.labelValue(
      document,
      'Invoice Number',
      invoice.invoice_no,
      leftX,
      top + 12,
    );
    this.labelValue(
      document,
      'Invoice Date',
      this.formatDate(invoice.date),
      leftX,
      top + 38,
    );
    this.labelValue(document, 'Status', invoice.status, leftX, top + 64);
    this.labelValue(document, 'Merchant', merchant.name, rightX, top + 12);
    this.labelValue(document, 'Phone', merchant.phone, rightX, top + 38);
    this.labelValue(
      document,
      'Transaction ID',
      invoice.transaction_id || 'N/A',
      rightX,
      top + 64,
    );
    document.y = top + 108;
  }

  private drawSummary(document: PDFKit.PDFDocument, summary: any): void {
    document
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(COLORS.navy)
      .text('INVOICE SUMMARY');
    document.moveDown(0.5);

    const top = document.y;
    const values = [
      ['Total Parcels', String(summary.total_parcels)],
      ['COD Collected', this.money(summary.total_cod_collected)],
      ['Delivery Charges', this.money(summary.total_delivery_charges)],
      ['Return Charges', this.money(summary.total_return_charges)],
      ['Net Payable', this.money(summary.payable_amount)],
    ];
    const width = 523 / values.length;
    values.forEach(([label, value], index) => {
      const x = 36 + index * width;
      document
        .rect(x, top, width, 52)
        .fillAndStroke(
          label === 'Net Payable' ? '#FFF1EB' : COLORS.white,
          COLORS.border,
        );
      document
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(label.toUpperCase(), x + 6, top + 9, {
          width: width - 12,
          align: 'center',
        });
      document
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(label === 'Net Payable' ? COLORS.orange : COLORS.navy)
        .text(value, x + 6, top + 28, {
          width: width - 12,
          align: 'center',
        });
    });
    document.y = top + 68;
  }

  private drawParcelTable(document: PDFKit.PDFDocument, parcels: any[]): void {
    document
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(COLORS.navy)
      .text('PARCEL DETAILS');
    document.moveDown(0.5);

    const columns = [
      { label: '#', x: 36, width: 24, align: 'center' as const },
      { label: 'Tracking / Order', x: 60, width: 117, align: 'left' as const },
      { label: 'Status', x: 177, width: 78, align: 'left' as const },
      { label: 'Collected', x: 255, width: 76, align: 'right' as const },
      { label: 'Fees', x: 331, width: 70, align: 'right' as const },
      { label: 'Return', x: 401, width: 70, align: 'right' as const },
      { label: 'Receivable', x: 471, width: 88, align: 'right' as const },
    ];
    const drawTableHeader = () => {
      const y = document.y;
      document.rect(36, y, 523, 24).fill(COLORS.navy);
      columns.forEach((column) => {
        document
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor(COLORS.white)
          .text(column.label, column.x + 4, y + 8, {
            width: column.width - 8,
            align: column.align,
            lineBreak: false,
          });
      });
      document.y = y + 24;
    };

    drawTableHeader();
    parcels.forEach((parcel, index) => {
      if (document.y + 34 > 790) {
        document.addPage();
        document.y = 42;
        drawTableHeader();
      }

      const y = document.y;
      const financial = parcel.financial_info;
      const breakdown = financial.breakdown;
      const fees = Number(breakdown.total_fee) || 0;
      const returnCharge = Number(breakdown.return_charge) || 0;
      const cells = [
        String(index + 1),
        `${parcel.parcel_info.tracking_number || 'N/A'}\n${parcel.parcel_info.order_id || ''}`,
        parcel.status_info.order_status || 'N/A',
        this.money(breakdown.collected_amount),
        this.money(fees),
        this.money(returnCharge),
        this.money(financial.receivable_amount),
      ];
      document
        .rect(36, y, 523, 34)
        .fillAndStroke(
          index % 2 === 0 ? COLORS.white : COLORS.soft,
          COLORS.border,
        );
      columns.forEach((column, columnIndex) => {
        document
          .font(columnIndex === 6 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(7.5)
          .fillColor(COLORS.navy)
          .text(cells[columnIndex], column.x + 4, y + 8, {
            width: column.width - 8,
            height: 22,
            align: column.align,
            ellipsis: true,
          });
      });
      document.y = y + 34;
    });
    document.moveDown(1.3);
  }

  private drawPaymentInformation(
    document: PDFKit.PDFDocument,
    details: any,
  ): void {
    if (document.y + 90 > 790) {
      document.addPage();
      document.y = 42;
    }

    const payment = details.payment_method;
    document
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(COLORS.navy)
      .text('PAYMENT INFORMATION');
    document.moveDown(0.5);
    const top = document.y;
    document
      .roundedRect(36, top, 523, 56, 5)
      .fillAndStroke(COLORS.soft, COLORS.border);
    this.labelValue(
      document,
      'Payment Method',
      payment?.method_type?.replace(/_/g, ' ') || 'Not configured',
      44,
      top + 12,
    );
    this.labelValue(
      document,
      'Payment Reference',
      details.invoice.payment_reference || 'N/A',
      310,
      top + 12,
    );
    this.labelValue(
      document,
      'Paid At',
      details.invoice.paid_at
        ? this.formatDate(details.invoice.paid_at)
        : 'Not paid',
      44,
      top + 34,
    );
  }

  private labelValue(
    document: PDFKit.PDFDocument,
    label: string,
    value: string,
    x: number,
    y: number,
  ): void {
    document
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(`${label}:`, x, y, { width: 86, lineBreak: false });
    document
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(COLORS.navy)
      .text(value || 'N/A', x + 88, y, {
        width: 155,
        ellipsis: true,
        lineBreak: false,
      });
  }

  private money(value: unknown): string {
    return `BDT ${(Number(value) || 0).toFixed(2)}`;
  }

  private formatDate(value: string | Date): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'N/A'
      : new Intl.DateTimeFormat('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Dhaka',
        }).format(date);
  }
}
