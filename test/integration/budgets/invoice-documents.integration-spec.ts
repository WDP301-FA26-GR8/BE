import { randomUUID } from 'node:crypto';
import type { ApiAccount } from '../../support/api-accounts';
import { DocumentHarness, PDF, type DocumentWire } from '../../support/document-harness';

const h = new DocumentHarness();

describe('invoice document attachments (integration, US-04-04 AC-4, AC-7, US-12-10 AC-5, US-01-12 AC-10)', () => {
  let head: ApiAccount;

  beforeAll(async () => {
    await h.start();
    head = await h.account('E-HEAD', await h.person('E-HEAD'), []);
  }, 180000);

  afterAll(async () => h.stop());

  async function createInvoiceWithTaxLines(
    opts: {
      contractId?: string | null;
      taxLines?: { position: number; payer: 'BUYER_REMITS' | 'VENDOR_COLLECTS' }[];
    } = {},
  ): Promise<string> {
    const org = await h.ctx.sql.query<{ id: string }>('SELECT id FROM organizations LIMIT 1');
    let vendorId = (await h.ctx.sql.query<{ id: string }>('SELECT id FROM vendors LIMIT 1')).rows[0]?.id;
    if (!vendorId) {
      vendorId = randomUUID();
      await h.ctx.sql.query(
        "INSERT INTO vendors (id, organization_id, name, normalized_name) VALUES ($1, $2, 'Figma', 'figma')",
        [vendorId, org.rows[0].id],
      );
    }
    const emp = await h.ctx.sql.query<{ id: string }>('SELECT id FROM employees LIMIT 1');
    const invoiceId = randomUUID();

    await h.ctx.sql.query(
      `INSERT INTO invoices (
        id, organization_id, vendor_id, contract_id, invoice_number, kind, invoice_date,
        amount_minor, amount_currency, amount_rate, amount_rate_date,
        amount_rate_source, amount_reporting_minor, recorded_by_employee_id
      ) VALUES (
        $1, $2, $3, $4, $5, 'INVOICE', CURRENT_DATE,
        100000, 'VND', 1.0, CURRENT_DATE,
        'MANUAL', 100000, $6
      )`,
      [invoiceId, org.rows[0].id, vendorId, opts.contractId ?? null, `INV-${randomUUID()}`, emp.rows[0].id],
    );

    if (opts.taxLines) {
      for (const line of opts.taxLines) {
        await h.ctx.sql.query(
          `INSERT INTO invoice_tax_lines (
            invoice_id, position, tax_type, rate_bp, amount_minor,
            amount_currency, amount_rate, amount_rate_date, amount_rate_source,
            amount_reporting_minor, payer, deductible, card_fee_or_fx
          ) VALUES (
            $1, $2, 'VAT', 1000, 10000,
            'VND', 1.0, CURRENT_DATE, 'MANUAL',
            10000, $3, true, false
          )`,
          [invoiceId, line.position, line.payer],
        );
      }
    }

    return invoiceId;
  }

  it('US-04-04 AC-4: Finance attaches original purchase document to an invoice without a contract; status becomes READY', async () => {
    const invoiceId = await createInvoiceWithTaxLines({ contractId: null });
    const doc = await h.uploaded(h.finance, { ...PDF, fileName: 'goc.pdf', purpose: 'PURCHASE_DOCUMENT' });

    const res = await h.attachInvoiceDocument(invoiceId, { documentId: doc.id }, h.finance).expect(201);
    const data = h.dataOf<{ document: DocumentWire }>(res);

    expect(data.document.id).toBe(doc.id);
    expect(data.document.invoiceId).toBe(invoiceId);
    expect(data.document.contractId).toBeNull();
    expect(data.document.status).toBe('READY');

    // DB verification
    const row = (
      await h.ctx.sql.query<{ status: string; invoice_id: string; contract_id: string | null; attached_at: string }>(
        'SELECT status, invoice_id, contract_id, attached_at FROM document_attachments WHERE id = $1',
        [doc.id],
      )
    ).rows[0];
    expect(row.status).toBe('READY');
    expect(row.invoice_id).toBe(invoiceId);
    expect(row.contract_id).toBeNull();
    expect(row.attached_at).not.toBeNull();
  });

  it('US-04-04 AC-7: Finance attaches tax proof; IT Admin and Finance can open it; department head is 403', async () => {
    const invoiceId = await createInvoiceWithTaxLines();
    const doc = await h.uploaded(h.finance, { ...PDF, fileName: 'thue.pdf', purpose: 'TAX_PAYMENT_PROOF' });

    await h.attachInvoiceDocument(invoiceId, { documentId: doc.id }, h.finance).expect(201);

    // Finance can open
    const financeRes = await h.linkDocument(doc.id, h.finance).expect(200);
    expect(h.dataOf<{ url: string }>(financeRes).url).toContain('download/documents');

    // IT Admin can open
    const itRes = await h.linkDocument(doc.id, h.it1).expect(200);
    expect(h.dataOf<{ url: string }>(itRes).url).toContain('download/documents');

    // Department head (MANAGER) gets 403
    const headRes = await h.linkDocument(doc.id, head).expect(403);
    expect(h.codeOf(headRes)).toBe('AUTHORIZATION.FORBIDDEN');
  });

  it('US-04-04 AC-7: IT Admin choosing TAX_PAYMENT_PROOF is refused when declaring upload', async () => {
    const res = await h.createDocument({ ...PDF, purpose: 'TAX_PAYMENT_PROOF' }, h.it1).expect(403);
    expect(h.codeOf(res)).toBe('DOCUMENT.PURPOSE_FORBIDDEN');
  });

  it('US-12-10 AC-5: attaches proof document to BUYER_REMITS tax line; tax line references document and document listed on invoice', async () => {
    const invoiceId = await createInvoiceWithTaxLines({
      taxLines: [
        { position: 1, payer: 'BUYER_REMITS' },
        { position: 2, payer: 'VENDOR_COLLECTS' },
      ],
    });
    const doc = await h.uploaded(h.finance, { ...PDF, fileName: 'chung-tu-thue.pdf', purpose: 'TAX_PAYMENT_PROOF' });

    await h.attachInvoiceDocument(invoiceId, { documentId: doc.id, taxLinePosition: 1 }, h.finance).expect(201);

    // Verify tax line points to the document
    const taxLine = (
      await h.ctx.sql.query<{ proof_document_id: string }>(
        'SELECT proof_document_id FROM invoice_tax_lines WHERE invoice_id = $1 AND position = 1',
        [invoiceId],
      )
    ).rows[0];
    expect(taxLine.proof_document_id).toBe(doc.id);

    // Verify document appears in GET /api/v1/invoices/:id/documents
    const listRes = await h.getInvoiceDocuments(invoiceId, h.finance).expect(200);
    const listData = h.dataOf<{ items: DocumentWire[] }>(listRes);
    expect(listData.items.map((i) => i.id)).toContain(doc.id);
  });

  it('refuses attaching proof to VENDOR_COLLECTS tax line with 422 INVOICE.TAX_LINE_NOT_BUYER_REMITS', async () => {
    const invoiceId = await createInvoiceWithTaxLines({
      taxLines: [{ position: 1, payer: 'VENDOR_COLLECTS' }],
    });
    const doc = await h.uploaded(h.finance, { ...PDF, fileName: 'proof.pdf', purpose: 'TAX_PAYMENT_PROOF' });

    const res = await h
      .attachInvoiceDocument(invoiceId, { documentId: doc.id, taxLinePosition: 1 }, h.finance)
      .expect(422);
    expect(h.codeOf(res)).toBe('INVOICE.TAX_LINE_NOT_BUYER_REMITS');

    // Tax line proof_document_id stays null
    const taxLine = (
      await h.ctx.sql.query<{ proof_document_id: string | null }>(
        'SELECT proof_document_id FROM invoice_tax_lines WHERE invoice_id = $1 AND position = 1',
        [invoiceId],
      )
    ).rows[0];
    expect(taxLine.proof_document_id).toBeNull();
  });

  it('US-01-12 AC-10: IT Admin attaching to invoice is refused (403), Finance attaching PURCHASE_DOCUMENT to contract is refused (403)', async () => {
    const contract = await h.contract();
    const invoiceId = await createInvoiceWithTaxLines();

    // IT Admin attaches to invoice -> refused
    const docForInvoice = await h.uploaded(h.it1, { ...PDF, purpose: 'PURCHASE_DOCUMENT' });
    const itRes = await h.attachInvoiceDocument(invoiceId, { documentId: docForInvoice.id }, h.it1).expect(403);
    expect(h.codeOf(itRes)).toBe('AUTHORIZATION.FORBIDDEN');

    // Finance attaches PURCHASE_DOCUMENT to contract -> refused
    const docForContract = await h.uploaded(h.finance, { ...PDF, purpose: 'PURCHASE_DOCUMENT' });
    const finRes = await h.attachDocument(docForContract.id, { contractId: contract }, h.finance).expect(403);
    expect(h.codeOf(finRes)).toBe('DOCUMENT.PURPOSE_FORBIDDEN');
  });

  it('US-01-12 AC-10: IT Admin attaches quote to contract; Finance attaches invoice to invoice', async () => {
    const contract = await h.contract();
    const invoiceId = await createInvoiceWithTaxLines();

    const quote = await h.uploaded(h.it1, { ...PDF, fileName: 'bao-gia-it.pdf', purpose: 'PURCHASE_DOCUMENT' });
    const invDoc = await h.uploaded(h.finance, { ...PDF, fileName: 'hoa-don-fin.pdf', purpose: 'PURCHASE_DOCUMENT' });

    await h.attachDocument(quote.id, { contractId: contract }, h.it1).expect(200);
    await h.attachInvoiceDocument(invoiceId, { documentId: invDoc.id }, h.finance).expect(201);
  });

  it('keeps CONTRACT_ATTACHMENT attachable by Finance to a contract', async () => {
    const contract = await h.contract();
    const doc = await h.uploaded(h.finance, { ...PDF, fileName: 'hop-dong-fin.pdf', purpose: 'CONTRACT_ATTACHMENT' });

    await h.attachDocument(doc.id, { contractId: contract }, h.finance).expect(200);
  });

  it('CHECK constraint refuses document row with both contract_id and invoice_id', async () => {
    const contract = await h.contract();
    const invoiceId = await createInvoiceWithTaxLines();
    const doc = await h.uploaded(h.it1, { ...PDF, purpose: 'CONTRACT_ATTACHMENT' });

    let err: unknown;
    try {
      await h.ctx.sql.query(
        `UPDATE document_attachments
        SET contract_id = $1, invoice_id = $2, status = 'READY', attached_at = now()
        WHERE id = $3`,
        [contract, invoiceId, doc.id],
      );
    } catch (e) {
      err = e;
    }
    expect((err as { code?: string }).code).toBe('23514');
    expect((err as { constraint?: string }).constraint).toBe('document_attachments_owner_state');
  });
});
