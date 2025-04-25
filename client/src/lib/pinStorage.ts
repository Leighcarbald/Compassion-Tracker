/**
 * Simple PIN storage utility for emergency info authentication
 * Uses localStorage directly with proper error handling
 */

// Storage key for authorized emergency info IDs
const STORAGE_KEY = 'emergency_pins_unlocked';

/**
 * Save an array of authorized emergency info IDs to localStorage
 */
export function saveUnlockedPins(ids: number[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    console.log('Saved emergency PIN IDs:', ids);
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
    if (!stored) return [];
    
    const ids = JSON.parse(stored);
    console.log('Loaded emergency PIN IDs:', ids);
    return Array.isArray(ids) ? ids : [];
  } catch (error) {
    console.error('Error loading emergency PIN IDs from localStorage:', error);
    return [];
  }
}

/**
 * Check if an emergency info ID is authorized
 */
export function isPinUnlocked(id: number): boolean {
  const unlockedPins = getUnlockedPins();
  const isUnlocked = unlockedPins.includes(id);
  console.log(`Checking if PIN ${id} is unlocked: ${isUnlocked}`);
  return isUnlocked;
}

/**
 * Set an emergency info ID as authorized
 */
export function unlockPin(id: number): void {
  const unlockedPins = getUnlockedPins();
  if (!unlockedPins.includes(id)) {
    unlockedPins.push(id);
    saveUnlockedPins(unlockedPins);
    console.log(`Unlocked PIN ${id}`);
  }
}

/**
 * Remove authorization for an emergency info ID
 */
export function lockPin(id: number): void {
  const unlockedPins = getUnlockedPins();
  const index = unlockedPins.indexOf(id);
  if (index !== -1) {
    unlockedPins.splice(index, 1);
    saveUnlockedPins(unlockedPins);
    console.log(`Locked PIN ${id}`);
  }
}