import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(date: Date | string): string {
  try {
    if (!date) return "N/A";
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
