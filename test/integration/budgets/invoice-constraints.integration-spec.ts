import { randomUUID } from 'node:crypto';
import { BudgetHarness } from '../../support/budget-harness';

const h = new BudgetHarness();
const CHECK = '23514';
const UNIQUE = '23505';

async function sqlState(text: string, values: unknown[] = []): Promise<string | null> {
  try {
    await h.ctx.sql.query(text, values);

    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown';
  }
}

describe('invoice constraints (B07-1, integration PostgreSQL)', () => {
  let vendorId: string;
  let employeeId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    await h.start();
    const unit = await h.departmentWithHead('P-INVCON');
    employeeId = unit.head.employeeId;

    vendorId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO vendors (id, organization_id, name, normalized_name)
       VALUES ($1, $2, 'Invoice Vendor', 'invoice-vendor')`,
      [vendorId, h.seed.organizationId],
    );

    const appGroupId = (
      await h.ctx.sql.query<{ id: string }>(`SELECT id FROM functional_groups WHERE organization_id = $1 LIMIT 1`, [
        h.seed.organizationId,
      ])
    ).rows[0]?.id;

    const appId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO applications (
         id, organization_id, vendor_id, functional_group_id, name, normalized_name,
         kind, business_owner_employee_id, data_sensitivity,
         comm_person_to_person_messaging, comm_calls_or_meetings, comm_mailbox, is_communication_service
       ) VALUES ($1, $2, $3, $4, 'Inv App', 'inv-app', 'SAAS', $5, 'LOW', false, false, false, false)`,
      [appId, h.seed.organizationId, vendorId, appGroupId, employeeId],
    );

    const planId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO plans (id, organization_id, application_id, name, normalized_name, provisioning_type, pricing_model, control_level)
       VALUES ($1, $2, $3, 'Plan A', 'plan-a', 'K2', 'PER_SEAT', 'FULL')`,
      [planId, h.seed.organizationId, appId],
    );

    subscriptionId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO subscriptions (id, organization_id, plan_id, kind, status, owner_department_id)
       VALUES ($1, $2, $3, 'TERM', 'DRAFT', $4)`,
      [subscriptionId, h.seed.organizationId, planId, unit.department.id],
    );
  }, 240000);

  afterAll(async () => {
    await h.stop();
  });

  const insertInvoice = async (over: Record<string, unknown> = {}) => {
    const id = (over.id as string) ?? randomUUID();
    const row = {
      id,
      organization_id: h.seed.organizationId,
      vendor_id: vendorId,
      contract_id: null,
      credited_invoice_id: null,
      invoice_number: `INV-${randomUUID().slice(0, 8)}`,
      kind: 'INVOICE',
      invoice_date: '2026-11-01',
      amount_minor: 1000000,
      amount_currency: 'VND',
      amount_rate: 1,
      amount_rate_date: '2026-11-01',
      amount_rate_source: 'MANUAL',
      amount_reporting_minor: 1000000,
      reconciliation_status: 'NONE',
      recorded_by_employee_id: employeeId,
      ...over,
    };

    const keys = Object.keys(row);
    const cols = keys.map((k) => `"${k}"`).join(', ');
    const params = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(row);

    return { id, state: await sqlState(`INSERT INTO invoices (${cols}) VALUES (${params})`, values) };
  };

  it('refuses kind = INVOICE with credited_invoice_id (invoices_credit_link CHECK)', async () => {
    const parent = await insertInvoice({ kind: 'INVOICE' });
    expect(parent.state).toBeNull();

    const result = await insertInvoice({
      kind: 'INVOICE',
      credited_invoice_id: parent.id,
    });
    expect(result.state).toBe(CHECK);
  });

  it('refuses invoice_lines with subscription_id and out_of_catalog = true (invoice_lines_subject CHECK)', async () => {
    const inv = await insertInvoice();
    expect(inv.state).toBeNull();

    const state = await sqlState(
      `INSERT INTO invoice_lines (
         id, invoice_id, position, subscription_id, description, out_of_catalog,
         amount_minor, amount_reporting_minor, fiscal_year, cost_reporting_minor, deductible_vat_reporting_minor
       ) VALUES ($1, $2, 1, $3, 'Item with both', true, 1000000, 1000000, 2026, 1000000, 0)`,
      [randomUUID(), inv.id, subscriptionId],
    );
    expect(state).toBe(CHECK);
  });

  it('refuses invoice_lines with neither subscription_id nor out_of_catalog = true (invoice_lines_subject CHECK)', async () => {
    const inv = await insertInvoice();
    expect(inv.state).toBeNull();

    const state = await sqlState(
      `INSERT INTO invoice_lines (
         id, invoice_id, position, subscription_id, description, out_of_catalog,
         amount_minor, amount_reporting_minor, fiscal_year, cost_reporting_minor, deductible_vat_reporting_minor
       ) VALUES ($1, $2, 1, null, 'Item with neither', false, 1000000, 1000000, 2026, 1000000, 0)`,
      [randomUUID(), inv.id],
    );
    expect(state).toBe(CHECK);
  });

  it('refuses invoice_tax_lines with rate_bp = 10001 (invoice_tax_lines_rate_range CHECK)', async () => {
    const inv = await insertInvoice();
    expect(inv.state).toBeNull();

    const state = await sqlState(
      `INSERT INTO invoice_tax_lines (
         invoice_id, position, tax_type, rate_bp, amount_minor, amount_currency,
         amount_rate, amount_rate_date, amount_rate_source, amount_reporting_minor,
         payer, deductible, card_fee_or_fx
       ) VALUES ($1, 1, 'VAT', 10001, 100000, 'VND', 1, '2026-11-01', 'MANUAL', 100000, 'VENDOR_COLLECTS', true, false)`,
      [inv.id],
    );
    expect(state).toBe(CHECK);
  });

  it('refuses duplicate organization, vendor, kind, invoice_number (unique constraint)', async () => {
    const invoiceNumber = `DUP-${randomUUID().slice(0, 8)}`;
    const first = await insertInvoice({ invoice_number: invoiceNumber, kind: 'INVOICE' });
    expect(first.state).toBeNull();

    const duplicate = await insertInvoice({ invoice_number: invoiceNumber, kind: 'INVOICE' });
    expect(duplicate.state).toBe(UNIQUE);
  });

  it('allows same invoice_number with different kind (INVOICE and CREDIT_NOTE)', async () => {
    const invoiceNumber = `SAME-${randomUUID().slice(0, 8)}`;
    const original = await insertInvoice({ invoice_number: invoiceNumber, kind: 'INVOICE' });
    expect(original.state).toBeNull();

    const creditNote = await insertInvoice({
      invoice_number: invoiceNumber,
      kind: 'CREDIT_NOTE',
      credited_invoice_id: original.id,
    });
    expect(creditNote.state).toBeNull();
  });
});
