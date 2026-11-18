import { Client } from 'pg';
import { OrganizationReadApi } from '../../../src/modules/organization/public/organization-read.api';
import { bodyOf } from '../../support/api-body';
import { DepartmentHarness } from '../../support/department-harness';

/** The correction of the first placement (`QĐ-113e`) against real PostgreSQL: the route, the audit and the trigger that lets only this change through. */
describe('PATCH /employees/{id}/first-placement (integration, real PostgreSQL)', () => {
  const h = new DepartmentHarness();

  const sqlState = async (
    client: Pick<Client, 'query'>,
    sql: string,
    params: unknown[] = [],
  ): Promise<string | null> => {
    try {
      await client.query(sql, params);
      return null;
    } catch (error) {
      return (error as { code?: string }).code ?? 'unknown';
    }
  };

  beforeAll(async () => {
    await h.start();
  }, 120000);

  afterAll(async () => {
    await h.stop();
  });

  async function person(code: string, departmentCode: string): Promise<string> {
    const today = await h.ctx.app.get(OrganizationReadApi).businessToday();
    const created = h.dataOf(
      await h
        .api()
        .post('/api/v1/employees')
        .set(h.asAdmin())
        .send({
          employeeCode: code,
          fullName: `Person ${code}`,
          workEmail: `${code.toLowerCase()}@acme.vn`,
          employmentType: 'STAFF',
          hireDate: today,
          departmentCode,
        })
        .expect(201),
    );
    return created.id;
  }

  const placementOf = async (employeeId: string) =>
    (
      await h.ctx.sql.query<{ id: string; department_id: string; valid_from: string }>(
        'SELECT id, department_id, valid_from::text AS valid_from FROM employee_placements WHERE employee_id = $1',
        [employeeId],
      )
    ).rows[0];

  it('changes the department and the day of a placement that starts after today, audits it and refuses what already took effect', async () => {
    const from = h.dataOf(await h.createDepartment(h.departmentBody({ code: 'P-FC1' })).expect(201));
    const to = h.dataOf(await h.createDepartment(h.departmentBody({ code: 'P-FC2' })).expect(201));
    const employeeId = await person('NV-FC1', from.code);

    // Placed today: already in effect, so a change of department is a transfer.
    const effective = await h
      .api()
      .patch(`/api/v1/employees/${employeeId}/first-placement`)
      .set(h.asAdmin())
      .send({ departmentId: to.id, reason: 'Wrong team' })
      .expect(409);
    expect(bodyOf(effective).error.code).toBe('EMPLOYEE.FIRST_PLACEMENT_ALREADY_EFFECTIVE');
    const placement = await placementOf(employeeId);
    expect(
      await sqlState(h.ctx.sql, 'UPDATE employee_placements SET department_id = $2 WHERE id = $1', [
        placement.id,
        to.id,
      ]),
    ).toBe('55000');

    // Dated for a later day (a plain write: nothing has been told yet).
    await h.ctx.sql.query('UPDATE employee_placements SET valid_from = valid_from + 30 WHERE id = $1', [placement.id]);
    const later = (await placementOf(employeeId)).valid_from;
    const { rows } = await h.ctx.sql.query<{ day: string }>('SELECT ($1::date + 5)::text AS day', [later]);

    const response = await h
      .api()
      .patch(`/api/v1/employees/${employeeId}/first-placement`)
      .set(h.asAdmin())
      .send({ departmentId: to.id, effectiveFrom: rows[0].day, reason: 'Wrong team' })
      .expect(200);

    const view = response.body as { data: { department: { id: string }; memberSince: string } };
    expect(view.data.department.id).toBe(to.id);
    expect(view.data.memberSince).toBe(rows[0].day);
    const after = await placementOf(employeeId);
    expect(after).toMatchObject({ id: placement.id, department_id: to.id, valid_from: rows[0].day });
    const audit = await h.ctx.sql.query(
      `SELECT 1 FROM audit_events WHERE action = 'EMPLOYEE.FIRST_PLACEMENT_CORRECTED' AND resource_id = $1`,
      [employeeId],
    );
    expect(audit.rowCount).toBe(1);
  });
});
