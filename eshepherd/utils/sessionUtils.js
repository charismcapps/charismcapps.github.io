// Utility functions for session management

/**
 * Get session validity time range in UTC
 * sessionName is assumed to be a date in SGT format (e.g., "2025-11-30")
 */
export function getSessionValidityRange(sessionName) {
  if (!sessionName) {
    return null;
  }
  
  // Parse session date (e.g., "2025-11-30") - this is in SGT
  const sessionDateMatch = sessionName.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!sessionDateMatch) {
    return null;
  }
  
  const [, year, month, day] = sessionDateMatch;
  
  // Session date is in SGT, so we need to:
  // 1. Create a date for the day after session date at 10am SGT
  // 2. Convert 10am SGT to UTC (SGT is UTC+8, so 10am SGT = 2am UTC)
  const sessionYear = parseInt(year);
  const sessionMonth = parseInt(month) - 1; // JavaScript months are 0-indexed
  const sessionDay = parseInt(day);
  
  // Create date for next day at 10am SGT, then convert to UTC
  // 10am SGT = 2am UTC on the same calendar date
  const validStartUtc = new Date(Date.UTC(sessionYear, sessionMonth, sessionDay + 1, 2, 0, 0, 0));
  
  // Valid until: 7 days later at the same time (2am UTC = 10am SGT)
  const validEndUtc = new Date(validStartUtc);
  validEndUtc.setUTCDate(validEndUtc.getUTCDate() + 7);
  
  return {
    startUtc: validStartUtc,
    endUtc: validEndUtc
  };
}

/**
 * Check if current time is within valid session period
 */
export function isSessionValid(sessionName) {
  if (!sessionName) {
    return false;
  }
  
  const range = getSessionValidityRange(sessionName);
  if (!range) {
    return false;
  }
  
  const nowUtc = new Date();
  return nowUtc >= range.startUtc && nowUtc < range.endUtc;
}

/**
 * Format UTC date for display in user's local timezone (without timezone suffix)
 */
export function formatLocalDateTimeNoTz(utcDate) {
  if (!utcDate) return '';
  // utcDate is a Date object in UTC, JavaScript will automatically convert to local timezone
  const localDate = new Date(utcDate);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Get timezone abbreviation for display
 */
export function getLocalTimeZoneName() {
  const now = new Date();
  const timeZoneName = now.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
  return timeZoneName;
}

/**
 * Get formatted valid time range string in user's local timezone
 */
export function getSessionValidTimeRangeString(sessionName) {
  if (!sessionName) {
    return '';
  }
  
  const range = getSessionValidityRange(sessionName);
  if (!range) {
    return '';
  }
  
  const startStr = formatLocalDateTimeNoTz(range.startUtc);
  const endStr = formatLocalDateTimeNoTz(range.endUtc);
  const timeZoneName = getLocalTimeZoneName();
  return `${startStr} to ${endStr} (${timeZoneName})`;
}

/**
 * Get session invalid message based on whether it's past or not started
 */
export function getSessionInvalidMessage(sessionName) {
  if (!sessionName) {
    return 'Session has not yet started.';
  }
  
  const range = getSessionValidityRange(sessionName);
  if (!range) {
    return 'Session has not yet started.';
  }
  
  const nowUtc = new Date();
  if (nowUtc < range.startUtc) {
    return 'Session has not yet started.';
  } else if (nowUtc >= range.endUtc) {
    return 'Session has Past Valid Checkin Period.';
  }
  
  return 'Session is Invalid as it is outside the valid Checkin Period.';
}

