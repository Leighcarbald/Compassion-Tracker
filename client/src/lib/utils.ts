import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(date: Date | string): string {
  try {
    if (!date) return "N/A";
    
    // Handle time strings in format "HH:MM:SS"
    if (typeof date === "string" && date.includes(":") && !date.includes("T")) {
      const [hours, minutes] = date.split(":");
      const hoursNum = parseInt(hours, 10);
      const minutesNum = parseInt(minutes, 10);
      
      // Create a date object for today with the specified time
      const dateObj = new Date();
      dateObj.setHours(hoursNum);
      dateObj.setMinutes(minutesNum);
      dateObj.setSeconds(0);
      
      return format(dateObj, "h:mm a");
    }
    
    // Handle regular date objects or ISO date strings
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date encountered in formatTime:', date);
      return "Invalid time";
    }
    
    return format(dateObj, "h:mm a");
  } catch (error) {
    console.error('Error formatting time:', error, date);
    return "Invalid time";
  }
}

export function formatDate(date: Date | string): string {
  try {
    if (!date) return "N/A";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date encountered in formatDate:', date);
      return "Invalid date";
    }
    
    return format(dateObj, "EEE, MMM d");
  } catch (error) {
    console.error('Error formatting date:', error, date);
    return "Invalid date";
  }
}

export function formatDateTime(date: Date | string): string {
  try {
    if (!date) return "N/A";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date encountered in formatDateTime:', date);
      return "Invalid date/time";
    }
    
    return format(dateObj, "MMM d, h:mm a");
  } catch (error) {
    console.error('Error formatting date/time:', error, date);
    return "Invalid date/time";
  }
}

export function getTimeAgo(date: Date | string): string {
  try {
    if (!date) return "N/A";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date encountered in getTimeAgo:', date);
      return "Unknown time";
    }
    
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    console.error('Error calculating time ago:', error, date);
    return "Unknown time";
  }
}

export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function formatDuration(durationInHours: number): string {
  const hours = Math.floor(durationInHours);
  const minutes = Math.round((durationInHours - hours) * 60);
  
  if (minutes === 0) {
    return `${hours} hr${hours !== 1 ? 's' : ''}`;
  }
  
  return `${hours}.${Math.floor(minutes / 6)} hrs`;
}

export function calculateSleepDuration(startTime: string, endTime: string | null): number {
  try {
    if (!endTime) return 0;
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.warn('Invalid date in calculateSleepDuration', { startTime, endTime });
      return 0;
    }
    
    // Calculate difference in milliseconds
    const diffMs = end.getTime() - start.getTime();
    
    // Convert to hours
    return diffMs / (1000 * 60 * 60);
  } catch (error) {
    console.error('Error calculating sleep duration:', error, { startTime, endTime });
    return 0;
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Formats a phone number string to (xxx) xxx-xxxx format
 * @param phoneNumberString - The phone number to format
 * @returns Formatted phone number or original string if invalid
 */
export function formatPhoneNumber(phoneNumberString: string): string {
  // Strip all non-numeric characters
  const cleaned = phoneNumberString.replace(/\D/g, '');
  
  // Check if we have exactly 10 digits (US phone number)
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  
  // Otherwise return the original input
  return phoneNumberString;
}

/**
 * Validates and normalizes a phone number while typing
 * @param phoneNumberString - The phone number being entered
 * @returns Formatted phone number for display during input
 */
export function normalizePhoneNumber(phoneNumberString: string): string {
  // Remove all non-numeric characters
  const cleaned = phoneNumberString.replace(/\D/g, '');
  
  // Limit to 10 digits
  const truncated = cleaned.slice(0, 10);
  
  // Format as user types
  if (truncated.length <= 3) {
    return truncated;
  } else if (truncated.length <= 6) {
    return `(${truncated.slice(0, 3)}) ${truncated.slice(3)}`;
  } else {
    return `(${truncated.slice(0, 3)}) ${truncated.slice(3, 6)}-${truncated.slice(6)}`;
  }
}

/**
 * Formats a Social Security Number without masking
 * @param ssn - The SSN to format
 * @returns Formatted SSN showing all digits
 */
export function maskSSN(ssn: string): string {
  if (!ssn) return "";
  
  // Remove all non-digit and non-hyphen characters
  const cleaned = ssn.replace(/[^\d-]/g, "");
  
  // If it already has hyphens, keep it as is
  if (cleaned.includes("-")) {
    return cleaned;
  }
  
  // Format SSN without hyphens (add hyphens)
  const digits = cleaned.replace(/-/g, "");
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  
  // If the SSN doesn't match expected format, return as is
  return cleaned;
}
