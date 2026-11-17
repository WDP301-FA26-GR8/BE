import { JsonColumnShapeError } from '../../../infrastructure/database/json-column.errors';
import { aiInvocationResultJson } from './invocation-result.json';

const RESULT = {
  total: 3,
  steps: [
    {
      sourceRef: 'R001',
      stepId: '00000000-0000-4000-8000-000000000001',
      requestId: '10000000-0000-4000-8000-000000000001',
      stepKind: 'SPEND_APPROVAL',
    },
  ],
  accepted: [{ sourceRef: 'R001', summary: 'Nhóm cần Notion, 1200000 VND.' }],
  rejections: [{ sourceRef: 'R002', code: 'INVENTED_NUMBER' }],
};

describe('the codec of ai_invocation_results.result', () => {
  it('reads and writes the result in the shape it has always been written in', () => {
    expect(aiInvocationResultJson.decode(RESULT)).toEqual(RESULT);
    expect(aiInvocationResultJson.encode(aiInvocationResultJson.decode(RESULT))).toEqual(RESULT);
  });

  it('refuses a result of another shape, naming the table and the column and never the value', () => {
    expect(() => aiInvocationResultJson.decode(null)).toThrow(JsonColumnShapeError);
    expect(() => aiInvocationResultJson.decode({ ...RESULT, total: -1 })).toThrow('ai_invocation_results.result');
    expect(() =>
      aiInvocationResultJson.decode({ ...RESULT, rejections: [{ sourceRef: 'R002', code: 'made up' }] }),
    ).toThrow('ai_invocation_results.result');
    expect(() => aiInvocationResultJson.decode({ ...RESULT, extra: 1 })).not.toThrow(/Notion/);
  });
});
