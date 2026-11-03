import { businessDateAt, type BusinessDate } from '../../../core/business-date';
import type { CostCenterRecord } from './cost-center.types';

/** A department link covers whole organization calendar days, from linkage until retirement. */
export function costCenterLinkedOn(
  link: Pick<CostCenterRecord, 'linkedAt' | 'deactivatedAt'>,
  onDate: BusinessDate,
  timeZone: string,
): boolean {
  return (
    link.linkedAt !== null &&
    businessDateAt(link.linkedAt, timeZone) <= onDate &&
    (link.deactivatedAt === null || onDate < businessDateAt(link.deactivatedAt, timeZone))
  );
}
