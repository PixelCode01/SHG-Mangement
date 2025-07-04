/**
 * Middleware to ensure collection day is always set based on collection frequency
 * This prevents groups from being created without proper collection schedule
 */

export function validateCollectionSchedule(data: {
  collectionFrequency?: string;
  collectionDayOfMonth?: number | null;
  collectionDayOfWeek?: string | null;
  collectionWeekOfMonth?: number | null;
}) {
  const frequency = data.collectionFrequency || 'MONTHLY';
  
  // Apply defaults and validate based on frequency
  switch (frequency) {
    case 'MONTHLY':
    case 'YEARLY':
      if (!data.collectionDayOfMonth) {
        // Auto-set default if not provided
        data.collectionDayOfMonth = 1;
      }
      if (data.collectionDayOfMonth < 1 || data.collectionDayOfMonth > 31) {
        throw new Error('Collection day of month must be between 1 and 31');
      }
      break;
      
    case 'WEEKLY':
      if (!data.collectionDayOfWeek) {
        // Auto-set default if not provided
        data.collectionDayOfWeek = 'MONDAY';
      }
      break;
      
    case 'FORTNIGHTLY':
      if (!data.collectionDayOfWeek) {
        data.collectionDayOfWeek = 'MONDAY';
      }
      if (!data.collectionWeekOfMonth) {
        data.collectionWeekOfMonth = 1;
      }
      if (data.collectionWeekOfMonth < 1 || data.collectionWeekOfMonth > 4) {
        throw new Error('Collection week of month must be between 1 and 4');
      }
      break;
  }
  
  return data;
}

/**
 * Middleware to be applied before creating or updating groups
 */
export function ensureCollectionSchedule(groupData: any): any {
  return validateCollectionSchedule(groupData);
}
