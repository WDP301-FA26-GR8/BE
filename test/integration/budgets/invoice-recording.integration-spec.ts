import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { readSqlState } from '../../../src/infrastructure/database/transaction-runner';
import { InvoiceReferenceInvalidError } from '../../../src/modules/budgets/invoice/invoice-record.errors';
import { AuditApi } from '../../../src/modules/audit/public/audit.api';
import type { RecordInvoiceInput } from '../../../src/modules/budgets/invoice/invoice.dto';
import {
  InvoiceDuplicateError,
  InvoiceLinesDoNotAddUpError,
  InvoiceLineVendorMismatchError,
  InvoiceRateMissingError,
  InvoiceVendorUnusableError,
} from '../../../src/modules/budgets/invoice/invoice.errors';
import { InvoiceRepo } from '../../../src/modules/budgets/invoice/invoice.repo';
import { InvoiceService } from '../../../src/modules/budgets/invoice/invoice.service';
import { BudgetHarness } from '../../support/budget-harness';
import { Barrier } from '../../support/concurrency-harness';

const h = new BudgetHarness();
const DAY = '2026-10-05';
type SavedInvoice = {
  id: string;
  amount_minor: string;
  amount_currency: string;
  amount_rate: string;
  amount_rate_date: string;
  amount_reporting_minor: string;
  reconciliation_status: string;
  recorded_by_employee_id: string;
};
type SavedLine = {
  amount_minor: string;
  amount_reporting_minor: string;
  cost_reporting_minor: string;
  deductible_vat_reporting_minor: string;
  cost_center_id: string | null;
  fiscal_year: number;
};

describe('invoice recording (PostgreSQL, B07-2)', () => {
  let service: InvoiceService;
  let vendorId: string;
  let subscriptionId: string;
  let otherSubscriptionId: string;
  let foreignSubscriptionId: string;
  const departmentIds = [randomUUID(), randomUUID()];
  const centerIds = [randomUUID(), randomUUID()];

  beforeAll(async () => {
    await h.start();
    service = h.ctx.app.get(InvoiceService);
    for (const [index, departmentId] of departmentIds.entries()) {
      await h.ctx.sql.query(
        `INSERT INTO departments (id, organization_id, code, name, created_at, updated_at)
        VALUES ($1, $2, $3, 'Invoice department', '2026-09-01T00:00:00Z', now())`,
        [departmentId, h.seed.organizationId, `P-INV-${index}`],
      );
      await h.ctx.sql.query(
        `INSERT INTO cost_centers (id, organization_id, department_id, code, name, kind,
        created_at, linked_at, updated_at) VALUES ($1, $2, $3, $4, 'Invoice unit', 'UNIT',
        '2026-10-01T18:30:00Z', '2026-10-01T18:30:00Z', now())`,
        [centerIds[index], h.seed.organizationId, departmentId, `CC-INV-${index}`],
      );
    }
    subscriptionId = await h.subscription(10, 'K2', departmentIds[0]);
    const planId = await h.planOf(subscriptionId);
    vendorId = (await h.vendorOf(planId)).id;
    otherSubscriptionId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO subscriptions (id, organization_id, plan_id, kind, owner_department_id)
      VALUES ($1, $2, $3, 'TERM', $4)`,
      [otherSubscriptionId, h.seed.organizationId, planId, departmentIds[1]],
    );
    foreignSubscriptionId = await h.subscription(5);
    await h
      .declareTaxProfile(vendorId, [
        { taxType: 'GTGT', ratePercent: '10', deductible: true },
        { taxType: 'TNDN', ratePercent: '5', deductible: false },
      ])
      .expect(200);
    await h.ctx.sql.query(
      `INSERT INTO exchange_rates (id, organization_id, currency, rate_date, rate)
      VALUES ($1, $2, 'USD', $3, 25000)`,
      [randomUUID(), h.seed.organizationId, DAY],
    );
    await h.setParameter('FISCAL_YEAR_START_MONTH', 4).expect(200);
  }, 180000);

  afterAll(async () => h.stop());

  function input(over: Partial<RecordInvoiceInput> = {}): RecordInvoiceInput {
    return {
      vendorId,
      invoiceNumber: `INV-${randomUUID()}`,
      invoiceDate: DAY,
      amount: { amount: '1000', currency: 'USD' },
      lines: [{ subscriptionId, outOfCatalog: false, description: 'Software', amount: '1000' }],
      taxLines: [],
      ...over,
    };
  }
  const actor = () => h.principalOf(h.finance, ['FINANCE']);
  const record = (body: RecordInvoiceInput) => service.record(actor(), body);
  const tax = (over: Partial<RecordInvoiceInput['taxLines'][number]> = {}): RecordInvoiceInput['taxLines'][number] => ({
    taxType: 'GTGT',
    rateBp: 1000,
    amount: { amount: '100', currency: 'USD' },
    payer: 'BUYER_REMITS',
    deductible: true,
    ...over,
  });
  const header = async (id: string) =>
    (
      await h.ctx.sql.query<SavedInvoice>(
        'SELECT *, amount_rate_date::text AS amount_rate_date FROM invoices WHERE id = $1',
        [id],
      )
    ).rows[0];
  const linesOf = async (id: string) =>
    (await h.ctx.sql.query<SavedLine>('SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY position', [id]))
      .rows;
  const audits = async (number: string) =>
    (
      await h.ctx.sql.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM audit_events WHERE action = 'INVOICE.RECORDED' AND after->>'invoiceNumber' = $1`,
        [number],
      )
    ).rows[0].count;
  async function expectNothing(number: string) {
    expect((await h.ctx.sql.query(`SELECT id FROM invoices WHERE invoice_number = $1`, [number])).rowCount).toBe(0);
    expect(await audits(number)).toBe(0);
  }

  it('stores each documented tax field and records one audit with actor and resource (AC-1)', async () => {
    const body = input({
      taxLines: [
        tax(),
        tax({ taxType: 'TNDN', rateBp: 500, amount: { amount: '50', currency: 'USD' }, deductible: false }),
      ],
    });
    const { id } = await record(body);
    const rows = (
      await h.ctx.sql.query(
        `SELECT tax_type, rate_bp, amount_minor, amount_currency, payer, deductible,
      card_fee_or_fx FROM invoice_tax_lines WHERE invoice_id = $1 ORDER BY position`,
        [id],
      )
    ).rows;
    expect(rows).toEqual([
      {
        tax_type: 'GTGT',
        rate_bp: 1000,
        amount_minor: '10000',
        amount_currency: 'USD',
        payer: 'BUYER_REMITS',
        deductible: true,
        card_fee_or_fx: false,
      },
      {
        tax_type: 'TNDN',
        rate_bp: 500,
        amount_minor: '5000',
        amount_currency: 'USD',
        payer: 'BUYER_REMITS',
        deductible: false,
        card_fee_or_fx: false,
      },
    ]);
    expect(await header(id)).toMatchObject({
      reconciliation_status: 'NONE',
      recorded_by_employee_id: h.finance.employeeId,
    });
    expect((await linesOf(id))[0]).toMatchObject({
      cost_reporting_minor: '26250000',
      deductible_vat_reporting_minor: '2500000',
    });
    const audit = (
      await h.ctx.sql.query(
        `SELECT resource_type, actor_app_user_id, actor_roles FROM audit_events
      WHERE action = 'INVOICE.RECORDED' AND resource_id = $1`,
        [id],
      )
    ).rows;
    expect(audit).toEqual([
      { resource_type: 'INVOICE', actor_app_user_id: h.finance.appUserId, actor_roles: ['FINANCE'] },
    ]);
    expect(await audits(body.invoiceNumber)).toBe(1);
  });

  it('freezes independent USD and VND conversions on invoiceDate, despite later rates (AC-7, D2)', async () => {
    const { id } = await record(input({ taxLines: [tax({ amount: { amount: '2000000', currency: 'VND' } })] }));
    const before = await header(id);
    const taxBefore = (
      await h.ctx.sql.query<{ amount_rate_date: string }>(
        'SELECT *, amount_rate_date::text AS amount_rate_date FROM invoice_tax_lines WHERE invoice_id = $1',
        [id],
      )
    ).rows;
    expect(before).toMatchObject({
      amount_minor: '100000',
      amount_reporting_minor: '25000000',
      amount_rate: '25000.0000000000',
    });
    expect(before.amount_rate_date).toBe(DAY);
    expect(taxBefore[0]).toMatchObject({
      amount_minor: '2000000',
      amount_reporting_minor: '2000000',
      amount_rate_source: 'SAME_CURRENCY',
      amount_rate: '1.0000000000',
    });
    expect(taxBefore[0].amount_rate_date).toBe(DAY);
    // The rate ledger is append-only: a later rate must leave the stored snapshots intact.
    await h.ctx.sql.query(
      `INSERT INTO exchange_rates (id, organization_id, currency, rate_date, rate)
      VALUES ($1, $2, 'USD', '2026-10-06', 30000)`,
      [randomUUID(), h.seed.organizationId],
    );
    expect(await header(id)).toEqual(before);
    expect(
      (
        await h.ctx.sql.query(
          'SELECT *, amount_rate_date::text AS amount_rate_date FROM invoice_tax_lines WHERE invoice_id = $1',
          [id],
        )
      ).rows,
    ).toEqual(taxBefore);
  });

  it.each(['header', 'tax'])('rejects a missing exact-day %s rate with no writes or audit', async (part) => {
    const body =
      part === 'header'
        ? input({ invoiceDate: '2026-10-04' })
        : input({ taxLines: [tax({ amount: { amount: '10', currency: 'EUR' } })] });
    await expect(record(body)).rejects.toBeInstanceOf(InvoiceRateMissingError);
    await expectNothing(body.invoiceNumber);
  });

  it('does not generate tax lines from the T2 profile; no-tax cost equals price (AC-6, AC-10)', async () => {
    const { id } = await record(input());
    expect((await h.ctx.sql.query('SELECT * FROM invoice_tax_lines WHERE invoice_id = $1', [id])).rowCount).toBe(0);
    expect((await linesOf(id))[0]).toMatchObject({
      cost_reporting_minor: '25000000',
      deductible_vat_reporting_minor: '0',
    });
  });

  it('rejects inconsistent line totals without persisting anything', async () => {
    const body = input({ lines: [{ subscriptionId, outOfCatalog: false, description: 'Wrong', amount: '999' }] });
    await expect(record(body)).rejects.toBeInstanceOf(InvoiceLinesDoNotAddUpError);
    await expectNothing(body.invoiceNumber);
  });

  it('rejects a subscription belonging to a different vendor', async () => {
    const body = input({
      lines: [
        { subscriptionId: foreignSubscriptionId, outOfCatalog: false, description: 'Wrong vendor', amount: '1000' },
      ],
    });
    await expect(record(body)).rejects.toBeInstanceOf(InvoiceLineVendorMismatchError);
    await expectNothing(body.invoiceNumber);
  });

  it('rejects an unknown vendor or subscription without writes', async () => {
    const vendor = input({ vendorId: randomUUID() });
    await expect(record(vendor)).rejects.toBeInstanceOf(InvoiceVendorUnusableError);
    await expectNothing(vendor.invoiceNumber);
    const subscription = input({
      lines: [{ subscriptionId: randomUUID(), outOfCatalog: false, description: 'Missing', amount: '1000' }],
    });
    await expect(record(subscription)).rejects.toBeInstanceOf(InvoiceReferenceInvalidError);
    await expectNothing(subscription.invoiceNumber);
  });

  it('conserves price, cost and VAT across two departments with a discount line', async () => {
    const { id } = await record(
      input({
        amount: { amount: '100', currency: 'VND' },
        lines: [
          { subscriptionId, outOfCatalog: false, description: 'First', amount: '70' },
          { subscriptionId: otherSubscriptionId, outOfCatalog: false, description: 'Second', amount: '40' },
          { outOfCatalog: true, description: 'Discount', amount: '-10' },
        ],
        taxLines: [
          tax({ amount: { amount: '1', currency: 'VND' }, deductible: false }),
          tax({ amount: { amount: '2', currency: 'VND' } }),
        ],
      }),
    );
    const lines = await linesOf(id);
    expect(lines.map((line) => line.cost_center_id)).toEqual([centerIds[0], centerIds[1], null]);
    const sum = (key: 'cost_reporting_minor' | 'amount_reporting_minor' | 'deductible_vat_reporting_minor') =>
      lines.reduce((n, row) => n + BigInt(row[key]), 0n);
    expect(sum('amount_reporting_minor')).toBe(100n);
    expect(sum('cost_reporting_minor')).toBe(101n);
    expect(sum('deductible_vat_reporting_minor')).toBe(2n);
    expect(BigInt(lines[2].cost_reporting_minor)).toBeLessThan(0n);
  });

  it('attributes a subscription to its owner department Cost Center on the invoice day', async () => {
    const { id } = await record(input());
    expect((await linesOf(id))[0].cost_center_id).toBe(centerIds[0]);
  });

  it('leaves attribution null before the link day, including the timezone boundary', async () => {
    const { id } = await record(input({ invoiceDate: '2026-10-01', amount: { amount: '1000', currency: 'VND' } }));
    expect((await linesOf(id))[0].cost_center_id).toBeNull();
  });

  it('uses fiscal year 2026 for 2027-02-15 when the year starts in April', async () => {
    const { id } = await record(input({ invoiceDate: '2027-02-15', amount: { amount: '1000', currency: 'VND' } }));
    expect((await linesOf(id))[0].fiscal_year).toBe(2026);
  });

  it('rolls back header and lines when PostgreSQL rejects a tax row', async () => {
    const body = input({ taxLines: [tax({ rateBp: 10001 })] });
    // Direct service input bypasses DTO validation to exercise the actual database CHECK mid-transaction.
    let state: string | undefined;
    try {
      await record(body);
    } catch (error) {
      state = readSqlState(error);
    }
    expect(state).toBe('23514');
    await expectNothing(body.invoiceNumber);
    expect(
      (
        await h.ctx.sql.query(
          `SELECT l.id FROM invoice_lines l LEFT JOIN invoices i ON i.id = l.invoice_id WHERE i.id IS NULL`,
        )
      ).rowCount,
    ).toBe(0);
  });

  it('rolls back all rows if recording the required audit fails', async () => {
    const body = input();
    const audit = h.ctx.app.get(AuditApi);
    const writeAudit = audit.record.bind(audit);
    const fault = jest.spyOn(audit, 'record').mockImplementationOnce(async (...args) => {
      await writeAudit(...args);
      throw new Error('Injected audit persistence failure');
    });
    try {
      await expect(record(body)).rejects.toThrow('Injected audit persistence failure');
    } finally {
      fault.mockRestore();
    }
    await expectNothing(body.invoiceNumber);
  });

  it('allows exactly one of two concurrent requests with the same invoice number and one audit', async () => {
    const body = input();
    const repo = h.ctx.app.get(InvoiceRepo);
    const insert = repo.insert.bind(repo);
    const barrier = new Barrier(2);
    const concurrent = jest.spyOn(repo, 'insert').mockImplementation(async (...args) => {
      await barrier.wait();
      return insert(...args);
    });
    try {
      const results = await Promise.allSettled([record(body), record(body)]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const failures = results.filter((result) => result.status === 'rejected');
      expect(failures).toHaveLength(1);
      expect(failures[0].reason).toBeInstanceOf(InvoiceDuplicateError);
    } finally {
      concurrent.mockRestore();
    }
    expect(
      (await h.ctx.sql.query('SELECT id FROM invoices WHERE invoice_number = $1', [body.invoiceNumber])).rowCount,
    ).toBe(1);
    expect(await audits(body.invoiceNumber)).toBe(1);
  });

  it('rejects all four forbidden roles before any persistent side effect (AC-9, AC-11)', async () => {
    const body = input();
    for (const role of ['IT_ADMIN', 'MANAGER', 'SPENDING_APPROVER', 'SUPER_ADMIN']) {
      await expect(service.record(h.principalOf(h.finance, [role]), body)).rejects.toThrow();
    }
    await expectNothing(body.invoiceNumber);
  });

  it('records through the real HTTP pipeline with Finance', async () => {
    const body = input();
    const response = await request(h.server()).post('/api/v1/invoices').set(h.as(h.finance)).send(body).expect(201);
    const result = h.dataOf<{ id: string }>(response);
    expect(await header(result.id)).toMatchObject({ amount_reporting_minor: '25000000' });
    expect(await audits(body.invoiceNumber)).toBe(1);
  });

  it('rejects an unknown optional contract as invalid input without an invoice or audit', async () => {
    const body = input({ contractId: randomUUID() });
    const response = await request(h.server()).post('/api/v1/invoices').set(h.as(h.finance)).send(body).expect(422);
    expect(h.codeOf(response)).toBe('VALIDATION_ERROR');
    await expectNothing(body.invoiceNumber);
  });
});
