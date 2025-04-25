import { createContext, useContext, useCallback, useState, useEffect, ReactNode } from 'react';

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
  const [unlockedPins, setUnlockedPins] = useState<Record<number, boolean>>({});

  // Load unlocked pins from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('emergency_unlocked_pins');
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('Loaded unlocked PINs from localStorage:', parsed);
        setUnlockedPins(parsed);
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }, []);

  // Save to localStorage when unlockedPins changes
  useEffect(() => {
    try {
      localStorage.setItem('emergency_unlocked_pins', JSON.stringify(unlockedPins));
      console.log('Saved unlocked PINs to localStorage:', unlockedPins);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [unlockedPins]);

  // Check if a PIN is unlocked
  const isUnlocked = useCallback((id: number): boolean => {
    return !!unlockedPins[id];
  }, [unlockedPins]);

  // Unlock a PIN
  const unlockPin = useCallback((id: number): void => {
    setUnlockedPins(prev => ({ ...prev, [id]: true }));
  }, []);

  // Lock a PIN
  const lockPin = useCallback((id: number): void => {
    setUnlockedPins(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
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