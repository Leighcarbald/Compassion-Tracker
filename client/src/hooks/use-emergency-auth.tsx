import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define the type for our context
type EmergencyAuthContextType = {
  authenticatedIds: Record<number, boolean>;
  setAuthenticated: (id: number, isAuthenticated: boolean) => void;
  isAuthenticated: (id: number) => boolean;
};

// Create the context
const EmergencyAuthContext = createContext<EmergencyAuthContextType | null>(null);

// Create the provider component
export function EmergencyAuthProvider({ children }: { children: ReactNode }) {
  // State to keep track of which emergency info IDs are authenticated
  const [authenticatedIds, setAuthenticatedIds] = useState<Record<number, boolean>>({});

  // Load authenticated IDs from localStorage on mount
  useEffect(() => {
    try {
      const storedAuth = localStorage.getItem('emergency_info_authenticated');
      if (storedAuth) {
        const parsedAuth = JSON.parse(storedAuth);
        console.log('Loaded authentication state from localStorage:', parsedAuth);
        setAuthenticatedIds(parsedAuth);
      }
    } catch (error) {
      console.error('Error loading authentication state from localStorage:', error);
    }
  }, []);

  // Save authenticated IDs to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('emergency_info_authenticated', JSON.stringify(authenticatedIds));
      console.log('Saved authentication state to localStorage:', authenticatedIds);
    } catch (error) {
      console.error('Error saving authentication state to localStorage:', error);
    }
  }, [authenticatedIds]);

  // Function to set an ID as authenticated or not
  const setAuthenticated = (id: number, isAuthenticated: boolean) => {
    setAuthenticatedIds(prev => {
      const newState = { ...prev, [id]: isAuthenticated };
      if (!isAuthenticated) {
        // If setting to not authenticated, remove the ID from the object
        delete newState[id];
      }
      return newState;
    });
  };

  // Function to check if an ID is authenticated
  const isAuthenticated = (id: number) => {
    return !!authenticatedIds[id];
  };

  return (
    <EmergencyAuthContext.Provider value={{ authenticatedIds, setAuthenticated, isAuthenticated }}>
      {children}
    </EmergencyAuthContext.Provider>
  );
}

// Custom hook to use the context
export function useEmergencyAuth() {
  const context = useContext(EmergencyAuthContext);
  if (!context) {
    throw new Error('useEmergencyAuth must be used within an EmergencyAuthProvider');
  }
  return context;
}