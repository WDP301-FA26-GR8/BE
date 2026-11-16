import { nullableJsonColumn } from '../../../infrastructure/database/json-column';
import { type HistorySnapshot, historySnapshotSchema } from './invocation-history.types';

/**
 * `ai_history_deliveries.payload`: the snapshot a SNAPSHOT delivery writes into MongoDB, NULL for a PURGE and once MongoDB confirmed
 * it. Protected like the history itself: never logged, never on HTTP. The migration that emptied `ai_invocation_contents` wrote the
 * same shape.
 */
export const historyPayloadJson = nullableJsonColumn({
  table: 'ai_history_deliveries',
  column: 'payload',
  schema: historySnapshotSchema,
  encode: (value: HistorySnapshot) => value,
});
