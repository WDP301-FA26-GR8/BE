import { Injectable } from '@nestjs/common';
import type { DbTx } from '../../../infrastructure/database/transaction-runner';
import { VendorRepo } from './vendor.repo';

/** What the facade of the catalog says of a vendor to the other modules: its name, and whether it exists. */
@Injectable()
export class VendorLookupService {
  constructor(private readonly vendors: VendorRepo) {}

  /** Vendors have no retirement state; existing rows remain usable for invoice recording. */
  async isUsable(id: string, tx?: DbTx): Promise<boolean> {
    return (tx ? await this.vendors.find(tx, id) : await this.vendors.findPublic(id)) !== null;
  }

  /** The name of the vendor, or null when there is none. */
  async nameOf(id: string): Promise<string | null> {
    return (await this.vendors.findPublic(id))?.name ?? null;
  }
}
