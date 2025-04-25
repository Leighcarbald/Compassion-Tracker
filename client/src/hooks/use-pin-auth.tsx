import { createContext, useContext, useCallback, useState, useEffect, ReactNode } from 'react';
import { getUnlockedPins, isPinUnlocked, lockPin as lockPinStorage, unlockPin as unlockPinStorage } from '@/lib/pinStorage';

// Define the context type with just the minimal functionality needed
interface PinAuthContextType {
  isUnlocked: (id: number) => boolean;
  unlockPin: (id: number) => void;
  lockPin: (id: number) => void;
}

// Create the context with default values
const PinAuthContext = createContext<PinAuthContextType | null>(null);

// Create the provider component
export function PinAuthProvider({ children }: { children: ReactNode }) {
  // State to store unlocked PIN IDs
  const [unlockedPins, setUnlockedPins] = useState<number[]>([]);

  // Load unlocked pins from localStorage on mount
  useEffect(() => {
    try {
      const loadedPins = getUnlockedPins();
      console.log('Loaded unlocked PINs:', loadedPins);
      setUnlockedPins(loadedPins);
    } catch (error) {
      console.error('Error loading unlocked PINs:', error);
    }
  }, []);
  
  // Always sync our state when localStorage changes
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (e.key === 'emergency_pins_unlocked') {
        try {
          const loadedPins = getUnlockedPins();
          console.log('Storage event detected, reloading PINs:', loadedPins);
          setUnlockedPins(loadedPins);
        } catch (error) {
          console.error('Error handling storage event:', error);
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Check if a PIN is unlocked
  const isUnlocked = useCallback((id: number): boolean => {
    try {
      // First check in memory state
      if (unlockedPins.includes(id)) {
        return true;
      }
      
      // Then check in localStorage
      return isPinUnlocked(id);
    } catch (error) {
      console.error("Error checking if PIN is unlocked:", error);
      return false;
    }
  }, [unlockedPins]);

  // Unlock a PIN
  const unlockPin = useCallback((id: number): void => {
    console.log(`Unlocking PIN ${id}`);
    try {
      // Update state
      setUnlockedPins(prev => {
        const newPins = [...prev];
        if (!newPins.includes(id)) {
          newPins.push(id);
        }
        return newPins;
      });
      
      // Update storage
      unlockPinStorage(id);
      
      // Double check it worked
      window.setTimeout(() => {
        console.log(`VERIFICATION: PIN ${id} is now unlocked: ${isPinUnlocked(id)}`);
      }, 100);
    } catch (error) {
      console.error("Error unlocking PIN:", error);
    }
  }, []);

  // Lock a PIN
  const lockPin = useCallback((id: number): void => {
    console.log(`Locking PIN ${id}`);
    try {
      // Update state
      setUnlockedPins(prev => prev.filter(pinId => pinId !== id));
      
      // Update storage
      lockPinStorage(id);
    } catch (error) {
      console.error("Error locking PIN:", error);
    }
  }, []);

  return (
    <PinAuthContext.Provider value={{ isUnlocked, unlockPin, lockPin }}>
      {children}
    </PinAuthContext.Provider>
  );
}

// Custom hook to use the context
export function usePinAuth() {
  const context = useContext(PinAuthContext);
  if (!context) {
    throw new Error('usePinAuth must be used within a PinAuthProvider');
  }
  return context;
}