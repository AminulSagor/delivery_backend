import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as bwipjs from 'bwip-js';
import { Parcel } from '../entities/parcel.entity';
import { ShippingLabelLayout } from '../dto/shipping-label.dto';

const MM = 72 / 25.4;
const COLORS = {
  orange: '#F15A24',
  navy: '#172033',
  muted: '#6B7280',
  border: '#D9DEE7',
  soft: '#F5F7FA',
  white: '#FFFFFF',
};

@Injectable()
export class ShippingLabelService {
  async generate(
    parcels: Parcel[],
    layout: ShippingLabelLayout,
  ): Promise<Buffer> {
    const pageSize: [number, number] =
      layout === ShippingLabelLayout.THERMAL
        ? [100 * MM, 150 * MM]
        : [595.28, 841.89];
    const document = new PDFDocument({
      autoFirstPage: false,
      size: pageSize,
      margin: 0,
      compress: true,
      info: {
        Title: 'Meghswar Shipping Labels',
        Author: 'Meghswar Courier',
        Subject: 'Parcel shipping labels',
      },
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });

    if (layout === ShippingLabelLayout.THERMAL) {
      for (const parcel of parcels) {
        document.addPage();
        await this.drawLabel(
          document,
          parcel,
          10,
          10,
          pageSize[0] - 20,
          pageSize[1] - 20,
        );
      }
    } else {
      const pageMargin = 24;
      const gap = 12;
      const labelWidth = pageSize[0] - pageMargin * 2;
      const labelHeight = (pageSize[1] - pageMargin * 2 - gap) / 2;

      for (let index = 0; index < parcels.length; index++) {
        if (index % 2 === 0) document.addPage();
        const slot = index % 2;
        const y = pageMargin + slot * (labelHeight + gap);
        await this.drawLabel(
          document,
          parcels[index],
          pageMargin,
          y,
          labelWidth,
          labelHeight,
        );
      }
    }

    document.end();
    return completed;
  }

  private async drawLabel(
    document: PDFKit.PDFDocument,
    parcel: Parcel,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<void> {
    const padding = Math.max(9, width * 0.022);
    const contentX = x + padding;
    const contentWidth = width - padding * 2;
    const scale = Math.min(width / 547, height / 385);
    const verticalScale = height / 385;
    const font = (size: number) => Math.max(6.5, size * scale);
    const line = Math.max(1, 1.1 * scale);

    document
      .save()
      .roundedRect(x, y, width, height, 8 * scale)
      .lineWidth(line)
      .strokeColor(COLORS.border)
      .stroke();

    document
      .fillColor(COLORS.orange)
      .font('Helvetica-Bold')
      .fontSize(font(22))
      .text('MEGH', contentX, y + padding - 1, { continued: true })
      .fillColor(COLORS.navy)
      .text('SWAR');
    document
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(font(7.5))
      .text(
        'COURIER  |  MOVE WITH CONFIDENCE',
        contentX,
        y + padding + 24 * verticalScale,
      );
    document
      .fillColor(COLORS.navy)
      .font('Helvetica-Bold')
      .fontSize(font(10))
      .text(
        'OFFICIAL SHIPPING LABEL',
        x + width * 0.58,
        y + padding + 4 * verticalScale,
        {
          width: width * 0.38 - padding,
          align: 'right',
        },
      );

    const barcodeText =
      parcel.tracking_number || parcel.parcel_tx_id || parcel.id;
    const barcode = await bwipjs.toBuffer({
      bcid: 'code128',
      text: barcodeText,
      scale: 2,
      height: 9,
      includetext: false,
      padding: 0,
      backgroundcolor: 'FFFFFF',
    });
    const barcodeY = y + 53 * verticalScale;
    document.image(barcode, contentX, barcodeY, {
      fit: [contentWidth, 40 * verticalScale],
      align: 'center',
    });
    document
      .fillColor(COLORS.navy)
      .font('Helvetica-Bold')
      .fontSize(font(9))
      .text(barcodeText, contentX, barcodeY + 42 * verticalScale, {
        width: contentWidth,
        align: 'center',
      });

    const merchantY = y + 109 * verticalScale;
    document
      .roundedRect(
        contentX,
        merchantY,
        contentWidth,
        42 * verticalScale,
        5 * scale,
      )
      .fill(COLORS.soft);
    const merchantName =
      parcel.store?.business_name ||
      parcel.merchant?.user?.full_name ||
      'Meghswar Merchant';
    document
      .fillColor(COLORS.orange)
      .circle(contentX + 20 * scale, merchantY + 21 * verticalScale, 13 * scale)
      .fill()
      .fillColor(COLORS.white)
      .font('Helvetica-Bold')
      .fontSize(font(12))
      .text(
        merchantName.charAt(0).toUpperCase(),
        contentX + 11 * scale,
        merchantY + 14 * verticalScale,
        {
          width: 18 * scale,
          align: 'center',
        },
      );
    document
      .fillColor(COLORS.navy)
      .font('Helvetica-Bold')
      .fontSize(font(12))
      .text(
        merchantName,
        contentX + 42 * scale,
        merchantY + 8 * verticalScale,
        {
          width: contentWidth - 50 * scale,
          ellipsis: true,
        },
      )
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(font(8))
      .text(
        parcel.store?.store_code
          ? `Store ${parcel.store.store_code}`
          : 'Verified Meghswar merchant',
        contentX + 42 * scale,
        merchantY + 25 * verticalScale,
      );

    const routeY = merchantY + 51 * verticalScale;
    const pickupHub =
      parcel.originHub?.branch_name ||
      parcel.store?.hub?.branch_name ||
      parcel.delivery_area ||
      'Pickup Hub';
    const deliveryHub =
      parcel.destinationHub?.branch_name ||
      parcel.delivery_coverage_area?.zone ||
      parcel.currentHub?.branch_name ||
      'Delivery Hub';
    this.drawPair(
      document,
      contentX,
      routeY,
      contentWidth,
      'PICKUP HUB',
      pickupHub,
      'DELIVERY HUB',
      deliveryHub,
      font,
      verticalScale,
    );

    const summaryY = routeY + 38 * verticalScale;
    const boxGap = 7 * scale;
    const boxWidth = (contentWidth - boxGap * 2) / 3;
    this.drawSummaryBox(
      document,
      contentX,
      summaryY,
      boxWidth,
      'COD',
      this.money(parcel.cod_amount),
      font,
      scale,
      verticalScale,
    );
    this.drawSummaryBox(
      document,
      contentX + boxWidth + boxGap,
      summaryY,
      boxWidth,
      'WEIGHT',
      `${Number(parcel.product_weight || 0).toFixed(2)} kg`,
      font,
      scale,
      verticalScale,
    );
    this.drawSummaryBox(
      document,
      contentX + (boxWidth + boxGap) * 2,
      summaryY,
      boxWidth,
      'ORDER ID',
      parcel.merchant_order_id || parcel.parcel_tx_id || '-',
      font,
      scale,
      verticalScale,
    );

    const detailsY = summaryY + 54 * verticalScale;
    document
      .fillColor(COLORS.muted)
      .font('Helvetica-Bold')
      .fontSize(font(7))
      .text('RECIPIENT DETAILS', contentX, detailsY);
    document
      .fillColor(COLORS.navy)
      .font('Helvetica-Bold')
      .fontSize(font(12))
      .text(
        parcel.customer_name || '-',
        contentX,
        detailsY + 11 * verticalScale,
        {
          width: contentWidth * 0.6,
          ellipsis: true,
        },
      );
    document
      .fontSize(font(9))
      .text(
        parcel.customer_phone || '-',
        contentX + contentWidth * 0.62,
        detailsY + 13 * verticalScale,
        {
          width: contentWidth * 0.38,
          align: 'right',
        },
      );
    document
      .fillColor(COLORS.muted)
      .font('Helvetica-Bold')
      .fontSize(font(7))
      .text('RECIPIENT ADDRESS', contentX, detailsY + 31 * verticalScale)
      .fillColor(COLORS.navy)
      .font('Helvetica')
      .fontSize(font(8.5))
      .text(
        parcel.customer_address || '-',
        contentX,
        detailsY + 42 * verticalScale,
        {
          width: contentWidth,
          height: 25 * verticalScale,
          ellipsis: true,
        },
      );

    const footerY = y + height - padding - 33 * verticalScale;
    document
      .moveTo(contentX, footerY - 7 * verticalScale)
      .lineTo(contentX + contentWidth, footerY - 7 * verticalScale)
      .lineWidth(Math.max(0.7, scale))
      .strokeColor(COLORS.border)
      .stroke();
    document
      .fillColor(COLORS.muted)
      .font('Helvetica-Bold')
      .fontSize(font(7))
      .text('DESCRIPTION', contentX, footerY)
      .fillColor(COLORS.navy)
      .font('Helvetica')
      .fontSize(font(7.5))
      .text(
        parcel.product_description || parcel.special_instructions || 'Parcel',
        contentX,
        footerY + 10 * verticalScale,
        {
          width: contentWidth * 0.67,
          height: 18 * verticalScale,
          ellipsis: true,
        },
      );
    document
      .fillColor(COLORS.muted)
      .fontSize(font(6.8))
      .text(
        this.formatDate(parcel.created_at),
        contentX + contentWidth * 0.7,
        footerY + 3 * verticalScale,
        {
          width: contentWidth * 0.3,
          align: 'right',
        },
      )
      .fillColor(COLORS.orange)
      .font('Helvetica-Bold')
      .text(
        'meghswar.com',
        contentX + contentWidth * 0.7,
        footerY + 15 * verticalScale,
        {
          width: contentWidth * 0.3,
          align: 'right',
        },
      );

    document.restore();
  }

  private drawPair(
    document: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    leftLabel: string,
    leftValue: string,
    rightLabel: string,
    rightValue: string,
    font: (size: number) => number,
    verticalScale: number,
  ) {
    document
      .fillColor(COLORS.muted)
      .font('Helvetica-Bold')
      .fontSize(font(7))
      .text(leftLabel, x, y)
      .text(rightLabel, x + width / 2, y, { width: width / 2, align: 'right' })
      .fillColor(COLORS.navy)
      .fontSize(font(9))
      .text(leftValue, x, y + 11 * verticalScale, {
        width: width * 0.48,
        ellipsis: true,
      })
      .text(rightValue, x + width * 0.52, y + 11 * verticalScale, {
        width: width * 0.48,
        align: 'right',
        ellipsis: true,
      });
  }

  private drawSummaryBox(
    document: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    font: (size: number) => number,
    scale: number,
    verticalScale: number,
  ) {
    document
      .roundedRect(x, y, width, 46 * verticalScale, 4 * scale)
      .fill(COLORS.soft);
    document
      .fillColor(COLORS.muted)
      .font('Helvetica-Bold')
      .fontSize(font(7))
      .text(label, x + 5 * scale, y + 7 * verticalScale, {
        width: width - 10 * scale,
        align: 'center',
      })
      .fillColor(COLORS.navy)
      .fontSize(font(11))
      .text(value, x + 5 * scale, y + 23 * verticalScale, {
        width: width - 10 * scale,
        align: 'center',
        ellipsis: true,
      });
  }

  private money(value: number | null | undefined): string {
    return `BDT ${Number(value || 0).toFixed(0)}`;
  }

  private formatDate(value: Date | null | undefined): string {
    const date = value ? new Date(value) : new Date();
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Dhaka',
    });
  }
}
