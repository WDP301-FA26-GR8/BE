import { Prisma } from '../../../generated/prisma/client';
import { JsonColumnShapeError } from '../../../infrastructure/database/json-column.errors';
import { historyPayloadJson } from './invocation-history-payload.json';

const CONTEXT = {
  generatedAt: '2026-11-04T09:00:00.000Z',
  requests: [
    {
      sourceRef: 'R001',
      stepKind: 'SPEND_APPROVAL',
      softwareName: 'Notion',
      beneficiaryDisplayName: 'Nhóm 5 người',
      reason: 'Họp nhóm',
      requestedDurationLabel: '6 tháng',
      estimatedCostRef: 'C001',
    },
  ],
};

const ANSWERED = {
  context: CONTEXT,
  promptText: 'prompt',
  rawResponse: '{"items":[]}',
  parsed: { items: [{ sourceRef: 'R001', stepKind: 'SPEND_APPROVAL', summary: 'Nhóm cần Notion, {{cost:C001}}.' }] },
  validation: { rejections: [{ sourceRef: 'R002', code: 'INVENTED_NUMBER' }] },
};

const ADMITTED = { context: CONTEXT, promptText: null, rawResponse: null, parsed: null, validation: null };

describe('the codec of ai_history_deliveries.payload (one snapshot of the raw history)', () => {
  it('reads and writes a snapshot of an answered call, and of a call not answered yet, as it is', () => {
    for (const snapshot of [ANSWERED, ADMITTED]) {
      expect(historyPayloadJson.decode(snapshot)).toEqual(snapshot);
      expect(historyPayloadJson.encode(historyPayloadJson.decode(snapshot))).toEqual(snapshot);
    }
  });

  it('reads a wiped payload as null and writes null as the database NULL', () => {
    expect(historyPayloadJson.decode(null)).toBeNull();
    expect(historyPayloadJson.encode(null)).toBe(Prisma.DbNull);
  });

  it.each([
    ['a field the snapshot does not have', { ...ADMITTED, result: {} }],
    ['no context', { ...ADMITTED, context: null }],
    [
      'a real id in place of a reference',
      { ...ADMITTED, context: { ...CONTEXT, requests: [{ ...CONTEXT.requests[0], sourceRef: 'step-1' }] } },
    ],
    [
      'more than 20 requests',
      { ...ADMITTED, context: { ...CONTEXT, requests: Array.from({ length: 21 }, () => CONTEXT.requests[0]) } },
    ],
    ['a parsed line of another shape', { ...ANSWERED, parsed: { items: [{ sourceRef: 'R001' }] } }],
    [
      'a rejection code that is not one',
      { ...ANSWERED, validation: { rejections: [{ sourceRef: 'R002', code: 'made up' }] } },
    ],
  ])('refuses a snapshot with %s, naming the table and the column and never the value', (_label, value) => {
    expect(() => historyPayloadJson.decode(value)).toThrow(JsonColumnShapeError);
    expect(() => historyPayloadJson.decode(value)).toThrow('ai_history_deliveries.payload');
    expect(() => historyPayloadJson.decode(value)).not.toThrow(/Notion|Họp nhóm/);
  });
});
