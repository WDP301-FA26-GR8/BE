import { randomUUID } from 'node:crypto';
import { BudgetHarness } from '../../support/budget-harness';
import { InvoiceService } from '../../../src/modules/budgets/invoice/invoice.service';
import { InvoiceQueryService } from '../../../src/modules/budgets/invoice/invoice-query.service';
import { PgRelay } from '../../support/pg-relay';
import { QueryCounter, dataStatements } from '../../support/query-count';

const h = new BudgetHarness();

describe('invoice reads (B07-4, integration PostgreSQL)', () => {
  let vendorId: string;
  let service: InvoiceService;
  let queryService: InvoiceQueryService;
  let relay: PgRelay;
  let counter: QueryCounter;

  const financeActor = () => h.principalOf(h.finance, ['FINANCE']);
  const itAdminActor = () => h.principalOf(h.finance, ['IT_ADMIN']);

  beforeAll(async () => {
    await h.start({
      appDatabaseUrl: async (directUrl) => {
        const url = new URL(directUrl);
        relay = await PgRelay.start(url.hostname, Number(url.port || 5432));
        url.port = String(relay.port);
        return url.toString();
      },
    });

    service = h.ctx.app.get(InvoiceService);
    queryService = h.ctx.app.get(InvoiceQueryService);
    counter = QueryCounter.on(relay);

    vendorId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO vendors (id, organization_id, name, normalized_name)
       VALUES ($1, $2, 'Invoice Read Vendor', 'invoice-read-vendor')`,
      [vendorId, h.seed.organizationId],
    );
  }, 240000);

  afterAll(async () => {
    await h.stop();
    await relay?.stop();
  });

  it('two invoices on the same date have a stable order across pages (invoice_date DESC, id DESC)', async () => {
    const inv1 = await service.record(financeActor(), {
      kind: 'INVOICE',
      vendorId,
      invoiceNumber: `INV-PAGE-1-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '100', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Item 1', amount: '100' }],
      taxLines: [],
    });

    const inv2 = await service.record(financeActor(), {
      kind: 'INVOICE',
      vendorId,
      invoiceNumber: `INV-PAGE-2-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '200', currency: 'VND' },
      lines: [{ outOfCatalog: true, description: 'Item 2', amount: '200' }],
      taxLines: [],
    });

    // Query with pageSize = 1
    const page1 = await queryService.pageInvoices(financeActor(), { page: 1, pageSize: 1 });
    const page2 = await queryService.pageInvoices(financeActor(), { page: 2, pageSize: 1 });

    expect(page1.items).toHaveLength(1);
    expect(page2.items).toHaveLength(1);
    expect(page1.items[0].id).not.toBe(page2.items[0].id);

    // If both belong to the top 2 items, their IDs sort descending when dates are equal
    const ids = [inv1.id, inv2.id].sort((a, b) => b.localeCompare(a));
    // The query returns page 1 first then page 2
    expect([page1.items[0].id, page2.items[0].id]).toEqual(ids);
  });

  it('query count: statement count does not increase between pageSize 10 and 50 (constant query count)', async () => {
    // Warm up
    await queryService.pageInvoices(financeActor(), { page: 1, pageSize: 10 });

    const run10 = await counter.run(() => queryService.pageInvoices(financeActor(), { page: 1, pageSize: 10 }));
    const run50 = await counter.run(() => queryService.pageInvoices(financeActor(), { page: 1, pageSize: 50 }));

    const count10 = dataStatements(run10.statements).length;
    const count50 = dataStatements(run50.statements).length;

    expect(count50).toBe(count10);
  });

  it('rate change after recording does not alter frozen conversion amounts on read', async () => {
    await h.ctx.sql.query(
      `INSERT INTO exchange_rates (id, organization_id, currency, rate, rate_date, source, created_at)
       VALUES (gen_random_uuid(), $1, 'USD', 25000, '2026-11-01', 'MANUAL', now())
       ON CONFLICT (organization_id, currency, rate_date) DO UPDATE SET rate = 25000`,
      [h.seed.organizationId],
    );

    // Record USD invoice at rate 25,000 on 2026-11-01
    const { id: invoiceId } = await service.record(financeActor(), {
      kind: 'INVOICE',
      vendorId,
      invoiceNumber: `INV-RATE-FREEZE-${randomUUID().slice(0, 8)}`,
      invoiceDate: '2026-11-01',
      amount: { amount: '1000', currency: 'USD' },
      lines: [{ outOfCatalog: true, description: 'USD software', amount: '1000' }],
      taxLines: [
        {
          taxType: 'GTGT',
          rateBp: 1000,
          amount: { amount: '100', currency: 'USD' },
          payer: 'VENDOR_COLLECTS',
          deductible: true,
        },
      ],
    });

    // Add a new exchange rate for a later date (e.g. 30,000)
    await h.ctx.sql.query(
      `INSERT INTO exchange_rates (id, organization_id, currency, rate, rate_date, source, created_at)
       VALUES (gen_random_uuid(), $1, 'USD', 30000, '2026-11-05', 'MANUAL', now())
       ON CONFLICT (organization_id, currency, rate_date) DO UPDATE SET rate = 30000`,
      [h.seed.organizationId],
    );

    // Read invoice detail
    const detail = await queryService.getInvoice(itAdminActor(), invoiceId);

    // Frozen at original reporting amount: 1000 * 25000 = 25,000,000 VND
    expect(detail.amountReporting).toEqual({ amount: '25000000', currency: 'VND' });
    expect(detail.amount).toEqual({ amount: '1000.00', currency: 'USD' });
    expect(detail.effectiveCost).toEqual({ amount: '25000000', currency: 'VND' });
    expect(detail.deductibleVat).toEqual({ amount: '2500000', currency: 'VND' });
  });
});
