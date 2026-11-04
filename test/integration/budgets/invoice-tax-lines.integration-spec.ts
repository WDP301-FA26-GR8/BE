import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { BudgetHarness } from '../../support/budget-harness';
import { InvoiceService } from '../../../src/modules/budgets/invoice/invoice.service';
import { InvoiceTaxLineService } from '../../../src/modules/budgets/invoice/invoice-tax-line.service';
import { InvoiceNotFoundError } from '../../../src/modules/budgets/invoice/invoice.errors';

const h = new BudgetHarness();

describe('invoice tax lines editing and defaults (B07-3, integration PostgreSQL)', () => {
  let vendorId: string;
  let service: InvoiceService;
  let taxLineService: InvoiceTaxLineService;
  const actor = () => h.principalOf(h.finance, ['FINANCE']);

  beforeAll(async () => {
    await h.start();
    service = h.ctx.app.get(InvoiceService);
    taxLineService = h.ctx.app.get(InvoiceTaxLineService);

    vendorId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO vendors (id, organization_id, name, normalized_name)
       VALUES ($1, $2, 'Tax Lines Vendor', 'tax-lines-vendor')`,
      [vendorId, h.seed.organizationId],
    );

    // Declare vendor tax profile: GTGT 10% (deductible = true), TNDN 5% (deductible = false)
    await request(h.server())
      .put(`/api/v1/vendors/${vendorId}/tax-profile`)
      .set(h.as(h.finance))
      .send({
        group: 'T2',
        lines: [
          { taxType: 'GTGT', ratePercent: '10', deductible: true },
          { taxType: 'TNDN', ratePercent: '5', deductible: false },
        ],
      })
      .expect(200);
  }, 240000);

  afterAll(async () => {
    await h.stop();
  });

  it('US-12-10 AC-2: reads vendor tax profile with deductible flags without creating lines', async () => {
    const res = await request(h.server())
      .get(`/api/v1/vendors/${vendorId}/tax-profile`)
      .set(h.as(h.finance))
      .expect(200);

    const data = h.dataOf<{ profile: { lines: Array<{ taxType: string; deductible: boolean }> } }>(res);
    expect(data.profile.lines).toEqual([
      expect.objectContaining({ taxType: 'GTGT', deductible: true }),
      expect.objectContaining({ taxType: 'TNDN', deductible: false }),
    ]);

    // Verifies no invoice lines or tax lines were created by reading
    const count = (await h.ctx.sql.query<{ count: string }>('SELECT count(*)::text as count FROM invoice_tax_lines'))
      .rows[0].count;
    expect(count).toBe('0');
  });

  it('US-12-10 AC-3: edits tax line, changes deductible to false -> effective cost increases, audit recorded', async () => {
    // Record invoice with base 1,000, GTGT 100 (deductible=true), TNDN 50 (deductible=false)
    const { id: invoiceId } = await service.record(actor(), {
      kind: 'INVOICE',
      vendorId,
      invoiceNumber: `INV-TL-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '1000', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Service', amount: '1000' }],
      taxLines: [
        {
          taxType: 'GTGT',
          rateBp: 1000,
          amount: { amount: '100', currency: 'VND' },
          payer: 'VENDOR_COLLECTS',
          deductible: true,
        },
        {
          taxType: 'TNDN',
          rateBp: 500,
          amount: { amount: '50', currency: 'VND' },
          payer: 'BUYER_REMITS',
          deductible: false,
        },
      ],
    });

    // Initial check: effective cost is 1,000 + 50 (non-deductible) = 1,050. Deductible VAT is 100.
    const initialLines = await h.ctx.sql.query<{
      cost_reporting_minor: string;
      deductible_vat_reporting_minor: string;
    }>('SELECT cost_reporting_minor, deductible_vat_reporting_minor FROM invoice_lines WHERE invoice_id = $1', [
      invoiceId,
    ]);
    expect(initialLines.rows[0].cost_reporting_minor).toBe('1050');
    expect(initialLines.rows[0].deductible_vat_reporting_minor).toBe('100');

    // Change GTGT (position 1) to deductible = false
    const updated = await taxLineService.update(actor(), invoiceId, 1, {
      taxType: 'GTGT',
      rateBp: 1000,
      amount: { amount: '100', currency: 'VND' },
      payer: 'VENDOR_COLLECTS',
      deductible: false,
      note: 'GTGT not deductible per review',
    });

    expect(updated).toMatchObject({
      position: 1,
      taxType: 'GTGT',
      deductible: false,
    });

    // New effective cost: 1,000 + 100 + 50 = 1,150. Deductible VAT = 0.
    const newLines = await h.ctx.sql.query<{
      cost_reporting_minor: string;
      deductible_vat_reporting_minor: string;
    }>('SELECT cost_reporting_minor, deductible_vat_reporting_minor FROM invoice_lines WHERE invoice_id = $1', [
      invoiceId,
    ]);
    expect(newLines.rows[0].cost_reporting_minor).toBe('1150');
    expect(newLines.rows[0].deductible_vat_reporting_minor).toBe('0');

    // Audit event INVOICE.TAX_LINE_CHANGED has before and after
    const audits = await h.ctx.sql.query<{
      action: string;
      before: { deductible: boolean };
      after: { deductible: boolean };
    }>('SELECT action, before, after FROM audit_events WHERE resource_id = $1 AND action = $2', [
      invoiceId,
      'INVOICE.TAX_LINE_CHANGED',
    ]);
    expect(audits.rows).toHaveLength(1);
    expect(audits.rows[0].before.deductible).toBe(true);
    expect(audits.rows[0].after.deductible).toBe(false);
  });

  it('US-12-10 AC-11: non-Finance roles cannot update tax lines', async () => {
    const { id: invoiceId } = await service.record(actor(), {
      kind: 'INVOICE',
      vendorId,
      invoiceNumber: `INV-AUTH-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '100', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Test', amount: '100' }],
      taxLines: [],
    });

    for (const role of ['IT_ADMIN', 'MANAGER', 'SPENDING_APPROVER', 'SUPER_ADMIN']) {
      await expect(
        taxLineService.update(h.principalOf(h.finance, [role]), invoiceId, 1, {
          taxType: 'GTGT',
          rateBp: 1000,
          amount: { amount: '10', currency: 'VND' },
          payer: 'VENDOR_COLLECTS',
          deductible: true,
        }),
      ).rejects.toThrow();
    }
  });

  it('US-12-09 AC-5: changing vendor tax profile later does not change recorded invoice tax lines', async () => {
    const { id: invoiceId } = await service.record(actor(), {
      kind: 'INVOICE',
      vendorId,
      invoiceNumber: `INV-VER-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '200', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Test', amount: '200' }],
      taxLines: [
        {
          taxType: 'GTGT',
          rateBp: 1000,
          amount: { amount: '20', currency: 'VND' },
          payer: 'VENDOR_COLLECTS',
          deductible: true,
        },
      ],
    });

    // Now update vendor tax profile to GTGT 8%
    await request(h.server())
      .put(`/api/v1/vendors/${vendorId}/tax-profile`)
      .set(h.as(h.finance))
      .send({
        group: 'T2',
        lines: [{ taxType: 'GTGT', ratePercent: '8', deductible: false }],
      })
      .expect(200);

    // Verify invoice tax line is untouched: still 10% (1000 bp) and deductible = true
    const taxLine = (
      await h.ctx.sql.query<{
        rate_bp: number;
        deductible: boolean;
      }>('SELECT rate_bp, deductible FROM invoice_tax_lines WHERE invoice_id = $1 AND position = 1', [invoiceId])
    ).rows[0];

    expect(taxLine.rate_bp).toBe(1000);
    expect(taxLine.deductible).toBe(true);
  });

  it('throws InvoiceNotFoundError for non-existent invoice', async () => {
    await expect(
      taxLineService.update(actor(), randomUUID(), 1, {
        taxType: 'GTGT',
        rateBp: 1000,
        amount: { amount: '10', currency: 'VND' },
        payer: 'VENDOR_COLLECTS',
        deductible: true,
      }),
    ).rejects.toThrow(InvoiceNotFoundError);
  });

  it('multi-line invoice: changing tax line redistributes effective cost so sum of lines equals total', async () => {
    const { id: invoiceId } = await service.record(actor(), {
      kind: 'INVOICE',
      vendorId,
      invoiceNumber: `INV-MULTI-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '1000', currency: 'VND' },
      lines: [
        { outOfCatalog: true, description: 'Line 1', amount: '600' },
        { outOfCatalog: true, description: 'Line 2', amount: '400' },
      ],
      taxLines: [
        {
          taxType: 'GTGT',
          rateBp: 1000,
          amount: { amount: '100', currency: 'VND' },
          payer: 'VENDOR_COLLECTS',
          deductible: true,
        },
      ],
    });

    // Change position 1 to deductible = false
    await taxLineService.update(actor(), invoiceId, 1, {
      taxType: 'GTGT',
      rateBp: 1000,
      amount: { amount: '100', currency: 'VND' },
      payer: 'VENDOR_COLLECTS',
      deductible: false,
    });

    const lines = await h.ctx.sql.query<{
      position: number;
      cost_reporting_minor: string;
      deductible_vat_reporting_minor: string;
    }>(
      'SELECT position, cost_reporting_minor, deductible_vat_reporting_minor FROM invoice_lines WHERE invoice_id = $1 ORDER BY position',
      [invoiceId],
    );

    // Total cost = 1,100 (1000 base + 100 non-deductible tax)
    // 60% of 1100 = 660, 40% of 1100 = 440
    expect(lines.rows[0].cost_reporting_minor).toBe('660');
    expect(lines.rows[1].cost_reporting_minor).toBe('440');
    expect(BigInt(lines.rows[0].cost_reporting_minor) + BigInt(lines.rows[1].cost_reporting_minor)).toBe(1100n);
    expect(lines.rows[0].deductible_vat_reporting_minor).toBe('0');
    expect(lines.rows[1].deductible_vat_reporting_minor).toBe('0');
  });
});
