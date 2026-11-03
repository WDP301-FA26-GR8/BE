import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { OBJECT_STORAGE } from '../../src/infrastructure/object-storage/object-storage.port';
import type { ApiAccount } from './api-accounts';
import { FakeObjectStorage } from './fake-object-storage';
import { ProvisioningHarness } from './provisioning-harness';

export interface DocumentWire {
  id: string;
  purpose: string;
  status: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  contractId: string | null;
  invoiceId: string | null;
  attachedAt: string | null;
}

export const PDF = { fileName: 'hop-dong-k1.pdf', contentType: 'application/pdf', sizeBytes: 2048 };

/** The installation with a storage in memory in place of the bucket, and the calls of contracts and files. */
export class DocumentHarness extends ProvisioningHarness {
  readonly storage = new FakeObjectStorage();

  override start(): Promise<void> {
    return super.start({ providerOverrides: [{ token: OBJECT_STORAGE, useValue: this.storage }] });
  }

  createContract = (body: object, account: ApiAccount = this.it1) =>
    request(this.server()).post('/api/v1/contracts').set(this.as(account)).send(body);
  getContract = (id: string, account: ApiAccount = this.it1) =>
    request(this.server()).get(`/api/v1/contracts/${id}`).set(this.as(account));
  createDocument = (body: object, account: ApiAccount = this.it1) =>
    request(this.server()).post('/api/v1/documents').set(this.as(account)).send(body);
  completeDocument = (id: string, account: ApiAccount = this.it1) =>
    request(this.server()).post(`/api/v1/documents/${id}/complete`).set(this.as(account));
  attachDocument = (id: string, body: object, account: ApiAccount = this.it1) =>
    request(this.server()).post(`/api/v1/documents/${id}/attach`).set(this.as(account)).send(body);
  attachInvoiceDocument = (invoiceId: string, body: object, account: ApiAccount = this.finance) =>
    request(this.server()).post(`/api/v1/invoices/${invoiceId}/documents`).set(this.as(account)).send(body);
  getInvoiceDocuments = (invoiceId: string, account: ApiAccount = this.finance) =>
    request(this.server()).get(`/api/v1/invoices/${invoiceId}/documents`).set(this.as(account));
  linkDocument = (id: string, account: ApiAccount = this.it1) =>
    request(this.server()).post(`/api/v1/documents/${id}/links`).set(this.as(account));
  getDocument = (id: string, account: ApiAccount = this.it1) =>
    request(this.server()).get(`/api/v1/documents/${id}`).set(this.as(account));

  /** A contract, as the IT Admin made it. */
  async contract(name = 'Hợp đồng K1'): Promise<string> {
    return this.dataOf<{ contract: { id: string } }>(await this.createContract({ name }).expect(201)).contract.id;
  }

  /** An invoice recorded in the database for document attachment tests. */
  async invoice(number = `INV-${randomUUID()}`): Promise<string> {
    const org = await this.ctx.sql.query<{ id: string }>('SELECT id FROM organizations LIMIT 1');
    let vendorId = (await this.ctx.sql.query<{ id: string }>('SELECT id FROM vendors LIMIT 1')).rows[0]?.id;
    if (!vendorId) {
      vendorId = randomUUID();
      await this.ctx.sql.query(
        "INSERT INTO vendors (id, organization_id, name, normalized_name) VALUES ($1, $2, 'Figma', 'figma')",
        [vendorId, org.rows[0].id],
      );
    }
    const emp = await this.ctx.sql.query<{ id: string }>('SELECT id FROM employees LIMIT 1');
    const id = randomUUID();
    await this.ctx.sql.query(
      `INSERT INTO invoices (
        id, organization_id, vendor_id, invoice_number, kind, invoice_date,
        amount_minor, amount_currency, amount_rate, amount_rate_date,
        amount_rate_source, amount_reporting_minor, recorded_by_employee_id
      ) VALUES (
        $1, $2, $3, $4, 'INVOICE', CURRENT_DATE,
        100000, 'VND', 1.0, CURRENT_DATE,
        'MANUAL', 100000, $5
      )`,
      [id, org.rows[0].id, vendorId, number, emp.rows[0].id],
    );
    return id;
  }

  /** A file declared, put in the storage as declared, and completed: it waits for its owner. */
  async uploaded(
    account: ApiAccount = this.it1,
    body: object = { ...PDF, purpose: 'CONTRACT_ATTACHMENT' },
  ): Promise<DocumentWire> {
    const declared = this.dataOf<{ document: DocumentWire }>(
      await this.createDocument(body, account).expect(201),
    ).document;
    await this.putObject(declared.id, { contentLength: declared.sizeBytes, contentType: declared.contentType });

    return this.dataOf<{ document: DocumentWire }>(await this.completeDocument(declared.id, account).expect(200))
      .document;
  }

  /** What the client does after the upload link: the object arrives under the key the system chose for the file. */
  async putObject(
    id: string,
    stored: { contentLength: number; contentType: string; content?: Uint8Array },
  ): Promise<string> {
    const key = await this.keyOf(id);
    this.storage.put(key, stored);

    return key;
  }

  async keyOf(id: string): Promise<string> {
    return (
      await this.ctx.sql.query<{ object_key: string }>(`SELECT object_key FROM document_attachments WHERE id = $1`, [
        id,
      ])
    ).rows[0].object_key;
  }

  /** Where the bytes that were looked at are kept: null until the file is uploaded and kept (SEC-01). */
  async finalKeyOf(id: string): Promise<string | null> {
    return (
      await this.ctx.sql.query<{ final_object_key: string | null }>(
        `SELECT final_object_key FROM document_attachments WHERE id = $1`,
        [id],
      )
    ).rows[0].final_object_key;
  }

  async statusOf(id: string): Promise<string> {
    return (await this.ctx.sql.query<{ status: string }>(`SELECT status FROM document_attachments WHERE id = $1`, [id]))
      .rows[0].status;
  }

  async documentCount(): Promise<number> {
    return Number(
      (await this.ctx.sql.query<{ n: string }>(`SELECT count(*) AS n FROM document_attachments`)).rows[0].n,
    );
  }

  /** Takes the IT Admin role away from an account the way the access reviews will. */
  async revokeItAdmin(account: ApiAccount): Promise<void> {
    await this.ctx.sql.query(
      `UPDATE role_grants SET revoked_at = now() WHERE app_user_id = $1 AND role = 'IT_ADMIN' AND revoked_at IS NULL`,
      [account.appUserId],
    );
  }
}
