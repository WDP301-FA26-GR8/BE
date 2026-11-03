import { randomUUID } from 'node:crypto';
import { TransactionRunner } from '../../../src/infrastructure/database/transaction-runner';
import { OrganizationHistoryApi } from '../../../src/modules/organization/public/organization-history.api';
import { SeatHarness } from '../../support/seat-baseline-harness';

const h = new SeatHarness();

describe('department Cost Center by organization calendar day (B07-2 step 3)', () => {
  let history: OrganizationHistoryApi;
  let departmentId: string;
  let costCenterId: string;

  beforeAll(async () => {
    await h.start();
    history = h.ctx.app.get(OrganizationHistoryApi);
    departmentId = randomUUID();
    costCenterId = randomUUID();
    await h.ctx.sql.query(
      `INSERT INTO departments (id, organization_id, code, name, created_at, updated_at)
       VALUES ($1, $2, 'P-HISTORY', 'Historical department', '2026-09-01T00:00:00Z', now())`,
      [departmentId, h.seed.organizationId],
    );
    // Historical fixture: inactive now, linked on Oct 2 and retired on Oct 11 in the organization zone.
    await h.ctx.sql.query(
      `INSERT INTO cost_centers (id, organization_id, department_id, code, name, kind, created_at, linked_at,
                                status, deactivated_at, updated_at)
       VALUES ($1, $2, $3, 'CC-HISTORY', 'Historical Cost Center', 'UNIT', '2026-10-01T18:30:00Z',
               '2026-10-01T18:30:00Z', 'INACTIVE', '2026-10-10T18:30:00Z', now())`,
      [costCenterId, h.seed.organizationId, departmentId],
    );
  }, 120_000);

  afterAll(async () => h.stop());

  it.each([
    ['2026-10-01', false],
    ['2026-10-02', true],
    ['2026-10-10', true],
    ['2026-10-11', false],
    ['2026-10-12', false],
  ])('answers the historical link on %s, regardless of the current inactive status', async (onDate, linked) => {
    expect(await history.getCostCenterOfDepartmentOn(departmentId, onDate)).toBe(linked ? costCenterId : null);
  });

  it('returns null for a department that does not exist or has no Cost Center', async () => {
    expect(await history.getCostCenterOfDepartmentOn(randomUUID(), '2026-10-05')).toBeNull();
    const bare = await h.bareDepartment();
    expect(await history.getCostCenterOfDepartmentOn(bare.id, '2026-10-05')).toBeNull();
  });

  it('reads the caller transaction and does not keep the uncommitted interval afterwards', async () => {
    const successorId = randomUUID();
    await expect(
      h.ctx.app.get(TransactionRunner).run(async (tx) => {
        await tx.costCenter.create({
          data: {
            id: successorId,
            organizationId: h.seed.organizationId,
            departmentId,
            code: 'CC-SUCCESSOR',
            name: 'Successor Cost Center',
            kind: 'UNIT',
            createdAt: new Date('2026-10-12T00:00:00Z'),
            linkedAt: new Date('2026-10-12T00:00:00Z'),
          },
        });
        expect(await history.getCostCenterOfDepartmentOn(departmentId, '2026-10-15', tx)).toBe(successorId);
        throw new Error('Rollback historical fixture');
      }),
    ).rejects.toThrow('Rollback historical fixture');
    expect(await history.getCostCenterOfDepartmentOn(departmentId, '2026-10-15')).toBeNull();
  });
});
