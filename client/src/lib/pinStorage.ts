/**
 * Simple PIN storage utility for emergency info authentication
 * Uses localStorage directly with proper error handling
 */

// Storage key for authorized emergency info IDs - this is the ONLY correct key
const STORAGE_KEY = 'emergency_pins_unlocked';

// Check for data in the old storage key and migrate it if found
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
 */
export function saveUnlockedPins(ids: number[]): void {
  try {
    console.log('SAVING PINS TO STORAGE:', ids);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    // Double check it was saved
    const savedValue = localStorage.getItem(STORAGE_KEY);
    console.log('CONFIRMED SAVED VALUE:', savedValue);
  } catch (error) {
    console.error('Error saving emergency PIN IDs to localStorage:', error);
  }
}

/**
 * Get all authorized emergency info IDs from localStorage
 */
export function getUnlockedPins(): number[] {
  try {
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