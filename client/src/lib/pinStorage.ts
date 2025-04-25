/**
 * Simple PIN storage utility for emergency info authentication
 * Uses localStorage directly with proper error handling
 * Includes security features for PIN expiration
 */

// Storage key for authorized emergency info IDs
const STORAGE_KEY = 'emergency_pins_unlocked';
// Storage key for timestamp to track when PINs were authorized
const TIMESTAMP_KEY = 'emergency_pins_timestamp';

// PINs expire after 15 minutes for security
const PIN_EXPIRATION_TIME = 15 * 60 * 1000;

// Clear all stored PINs on module load for security reasons
// This ensures no unauthorized access persists between sessions
try {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TIMESTAMP_KEY);
  console.log('Cleared all stored PINs on application startup for security');
} catch (error) {
  console.error('Error clearing stored PINs:', error);
}

// This migration code is kept for backward compatibility
try {
  const oldStoredData = localStorage.getItem('emergency_unlocked_pins');
  if (oldStoredData && !localStorage.getItem(STORAGE_KEY)) {
    console.log('Found data in old storage key, migrating to new key');
    localStorage.setItem(STORAGE_KEY, oldStoredData);
    console.log('Data migrated successfully');
    // Clear old storage to avoid confusion
    localStorage.removeItem('emergency_unlocked_pins');
  }
} catch (error) {
  console.error('Error migrating PIN data:', error);
}

/**
 * Save an array of authorized emergency info IDs to localStorage
 * with timestamp for security expiration
 */
export function saveUnlockedPins(ids: number[]): void {
  try {
    console.log('SAVING PINS TO STORAGE:', ids);
    
    // Ensure we have a clean array of numbers
    const cleanIds = Array.isArray(ids) 
      ? ids.filter(id => typeof id === 'number') 
      : [];
    
    // Save the PIN IDs array
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanIds));
    
    // Save the current timestamp for expiration checking
    localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
    console.log(`PIN authentication timestamp set: ${new Date().toISOString()}`);
    
    // Double check it was saved
    const savedValue = localStorage.getItem(STORAGE_KEY);
    console.log('CONFIRMED SAVED VALUE:', savedValue);
    
    // Verify the item can be correctly retrieved
    const test = getUnlockedPins();
    console.log('TEST RETRIEVAL RESULT:', test);
  } catch (error) {
    console.error('Error saving emergency PIN IDs to localStorage:', error);
  }
}

/**
 * Check if stored PIN data is still valid based on timestamp
 * Returns false if PINs have expired, which will force re-authentication
 */
function isPinDataValid(): boolean {
  try {
    const timestampStr = localStorage.getItem(TIMESTAMP_KEY);
    if (!timestampStr) {
      console.log('No PIN timestamp found, treating as expired');
      return false;
    }
    
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      console.error('Invalid PIN timestamp stored');
      return false;
    }
    
    const now = Date.now();
    const elapsedTime = now - timestamp;
    
    // Check if the timestamp is in the future (clock manipulation)
    if (timestamp > now) {
      console.error('PIN timestamp is in the future, possible clock manipulation');
      return false;
    }
    
    // Check if the timestamp is too old (expired)
    if (elapsedTime > PIN_EXPIRATION_TIME) {
      console.log(`PIN auth expired after ${Math.round(elapsedTime/1000/60)} minutes`);
      // Clear expired data for security
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TIMESTAMP_KEY);
      return false;
    }
    
    console.log(`PIN auth valid, expires in ${Math.round((PIN_EXPIRATION_TIME - elapsedTime)/1000/60)} minutes`);
    return true;
  } catch (error) {
    console.error('Error checking PIN timestamp validity:', error);
    return false;
  }
}

/**
 * Get all authorized emergency info IDs from localStorage
 * with expiration check for better security
 */
export function getUnlockedPins(): number[] {
  try {
    // First check if PINs have expired
    if (!isPinDataValid()) {
      console.log('PIN data expired or invalid, forcing re-authentication');
      return [];
    }
    
    const stored = localStorage.getItem(STORAGE_KEY);
    console.log('RAW PIN STORAGE VALUE:', stored);
    
    if (!stored) {
      console.log('NO STORED PINS FOUND, RETURNING EMPTY ARRAY');
      return [];
    }
    
    let parsedIds: any;
    try {
      parsedIds = JSON.parse(stored);
      console.log('PARSED PIN IDS:', parsedIds);
    } catch (parseError) {
      console.error('ERROR PARSING PIN STORAGE:', parseError);
      return [];
    }
    
    // Ensure we have an array
    const ids = Array.isArray(parsedIds) ? parsedIds : [];
    console.log('FINAL PIN IDS ARRAY:', ids);
    return ids;
  } catch (error) {
    console.error('CRITICAL ERROR loading emergency PIN IDs from localStorage:', error);
    return [];
  }
}

/**
 * Check if an emergency info ID is authorized
 */
export function isPinUnlocked(id: number): boolean {
  if (typeof id !== 'number') {
    console.error(`INVALID PIN ID: ${id}`);
    return false;
  }
  
  console.log(`CHECKING IF PIN ${id} IS UNLOCKED`);
  const unlockedPins = getUnlockedPins();
  const isUnlocked = unlockedPins.includes(id);
  console.log(`PIN ${id} IS UNLOCKED: ${isUnlocked}`);
  return isUnlocked;
}

/**
 * Set an emergency info ID as authorized
 */
export function unlockPin(id: number): void {
  if (typeof id !== 'number') {
    console.error(`CANNOT UNLOCK INVALID PIN ID: ${id}`);
    return;
  }
  
  console.log(`UNLOCKING PIN ${id}`);
  const unlockedPins = getUnlockedPins();
  if (!unlockedPins.includes(id)) {
    unlockedPins.push(id);
    saveUnlockedPins(unlockedPins);
    console.log(`SUCCESSFULLY UNLOCKED PIN ${id}`);
  } else {
    console.log(`PIN ${id} WAS ALREADY UNLOCKED`);
  }
}

/**
 * Remove authorization for an emergency info ID
 */
export function lockPin(id: number): void {
  if (typeof id !== 'number') {
    console.error(`CANNOT LOCK INVALID PIN ID: ${id}`);
    return;
  }
  
  console.log(`LOCKING PIN ${id}`);
  const unlockedPins = getUnlockedPins();
  const index = unlockedPins.indexOf(id);
  if (index !== -1) {
    unlockedPins.splice(index, 1);
    saveUnlockedPins(unlockedPins);
    console.log(`SUCCESSFULLY LOCKED PIN ${id}`);
  } else {
    console.log(`PIN ${id} WAS NOT UNLOCKED`);
  }
}