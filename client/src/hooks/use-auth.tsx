import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseQueryResult,
  UseMutationResult,
} from "@tanstack/react-query";
import { InsertUser, User } from "@shared/schema";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import * as webauthnBrowser from "@simplewebauthn/browser";

// Types
type LoginData = {
  username: string;
  password: string;
};

type RegisterData = {
  username: string;
  password: string;
  name: string;
  email: string;
};

type BiometricLoginStartResponse = {
  options: PublicKeyCredentialRequestOptions;
};

type BiometricRegisterStartResponse = {
  options: PublicKeyCredentialCreationOptions;
};

type BiometricAuthStatus = {
  available: boolean;
  registered: boolean;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
  biometricStatus: UseQueryResult<BiometricAuthStatus>;
  registerBiometricMutation: UseMutationResult<any, Error, void>;
  loginWithBiometricMutation: UseMutationResult<User, Error, void>;
};

// Context
export const AuthContext = createContext<AuthContextType | null>(null);

// Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // Query to get the current user
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/user");
        return await res.json();
      } catch (error) {
        // Return null instead of throwing on 401 to handle unauthenticated state gracefully
        if (error instanceof Response && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.name || user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.name || user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check if biometrics are available and registered
  const biometricStatus = useQuery<BiometricAuthStatus>({
    queryKey: ["/api/webauthn/status"],
    queryFn: async () => {
      // First check if the browser supports WebAuthn
      const available = await webauthnBrowser.browserSupportsWebAuthn();
      
      // If WebAuthn is supported, check if the user has registered credentials
      if (available && user) {
        try {
          const res = await apiRequest("GET", "/api/webauthn/status");
          const data = await res.json();
          return { available, registered: data.registered };
        } catch (error) {
          console.error("Error checking WebAuthn status:", error);
          return { available, registered: false };
        }
      }
      
      return { available: available, registered: false };
    },
    // Only run if we have a user
    enabled: !!user,
  });

  // Register biometric credentials
  const registerBiometricMutation = useMutation({
    mutationFn: async () => {
      // 1. Get registration options from the server
      const regOptionsResponse = await apiRequest("GET", "/api/webauthn/register/start");
      const regOptionsData: BiometricRegisterStartResponse = await regOptionsResponse.json();

      // 2. Use the browser API to create the credentials
      const credential = await webauthnBrowser.startRegistration(regOptionsData.options);

      // 3. Send the credential back to the server for verification
      const verificationResponse = await apiRequest("POST", "/api/webauthn/register/finish", credential);
      return await verificationResponse.json();
    },
    onSuccess: () => {
      toast({
        title: "Biometric registration successful",
        description: "You can now sign in using your fingerprint or Face ID",
      });
      // Refresh biometric status
      queryClient.invalidateQueries({ queryKey: ["/api/webauthn/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Biometric registration failed",
        description: error.message || "Failed to register biometric credentials",
        variant: "destructive",
      });
    },
  });

  // Login with biometric credentials
  const loginWithBiometricMutation = useMutation({
    mutationFn: async () => {
      // 1. Get authentication options from the server
      const authOptionsResponse = await apiRequest("GET", "/api/webauthn/login/start");
      const authOptionsData: BiometricLoginStartResponse = await authOptionsResponse.json();

      // 2. Use the browser API to get the assertion
      const assertion = await webauthnBrowser.startAuthentication(authOptionsData.options);

      // 3. Send the assertion back to the server for verification
      const verificationResponse = await apiRequest("POST", "/api/webauthn/login/finish", assertion);
      return await verificationResponse.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Biometric login successful",
        description: `Welcome back, ${user.name || user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Biometric login failed",
        description: error.message || "Authentication failed",
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error: error as Error | null,
        loginMutation,
        logoutMutation,
        registerMutation,
        biometricStatus,
        registerBiometricMutation,
        loginWithBiometricMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}