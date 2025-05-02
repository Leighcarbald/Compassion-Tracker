import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export type HealthProvider = 'google' | 'apple' | 'fitbit' | 'samsung' | 'garmin';
export type HealthDataType = 'sleep' | 'bloodPressure' | 'glucose' | 'heartRate' | 'activity';

export interface HealthPlatformConnection {
  id: number;
  provider: HealthProvider;
  syncEnabled: boolean;
  lastSynced: string | null;
  createdAt: string;
}

export function useHealthPlatforms(careRecipientId?: number) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connectingProvider, setConnectingProvider] = useState<HealthProvider | null>(null);

  // Get all health platform connections for a care recipient
  const { 
    data: connections,
    isLoading: isLoadingConnections,
    error: connectionsError
  } = useQuery({
    queryKey: ['/api/health-platforms/connections', careRecipientId],
    queryFn: async () => {
      if (!careRecipientId) return [];
      const res = await fetch(`/api/health-platforms/connections?careRecipientId=${careRecipientId}`);
      if (!res.ok) throw new Error('Failed to fetch health platform connections');
      return await res.json() as HealthPlatformConnection[];
    },
    enabled: !!careRecipientId,
  });

  // Start OAuth flow to connect a health platform
  const startAuthFlowMutation = useMutation({
    mutationFn: async (provider: HealthProvider) => {
      if (!careRecipientId) throw new Error('Care recipient ID is required');
      setConnectingProvider(provider);
      
      const res = await fetch(`/api/health-platforms/auth-url?provider=${provider}&careRecipientId=${careRecipientId}`);
      if (!res.ok) throw new Error(`Failed to get auth URL for ${provider}`);
      
      const { authUrl } = await res.json();
      window.location.href = authUrl;
      return true;
    },
    onError: (error) => {
      setConnectingProvider(null);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to start authentication flow",
        variant: "destructive",
      });
    }
  });

  // Update a health platform connection (enable/disable sync)
  const updateConnectionMutation = useMutation({
    mutationFn: async ({ connectionId, syncEnabled }: { connectionId: number, syncEnabled: boolean }) => {
      const res = await fetch(`/api/health-platforms/connections/${connectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncEnabled }),
      });
      
      if (!res.ok) throw new Error('Failed to update health platform connection');
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/health-platforms/connections', careRecipientId] });
      toast({
        title: "Connection Updated",
        description: "Health platform connection updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update health platform connection",
        variant: "destructive",
      });
    }
  });

  // Delete a health platform connection
  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      const res = await fetch(`/api/health-platforms/connections/${connectionId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) throw new Error('Failed to delete health platform connection');
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/health-platforms/connections', careRecipientId] });
      toast({
        title: "Connection Removed",
        description: "Health platform connection removed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Removal Failed",
        description: error instanceof Error ? error.message : "Failed to remove health platform connection",
        variant: "destructive",
      });
    }
  });

  // Manually trigger sync for health data
  const syncHealthDataMutation = useMutation({
    mutationFn: async ({ 
      dataType, 
      provider 
    }: { 
      dataType?: HealthDataType, 
      provider?: HealthProvider 
    } = {}) => {
      if (!careRecipientId) throw new Error('Care recipient ID is required');
      
      const res = await fetch(`/api/health-platforms/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          careRecipientId, 
          dataType,
          provider,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to sync health data');
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sync Initiated",
        description: "Health data synchronization has started",
      });
      
      // Invalidate queries that may have been affected by the sync
      queryClient.invalidateQueries({ queryKey: ['/api/sleep'] });
      queryClient.invalidateQueries({ queryKey: ['/api/blood-pressure'] });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync health data",
        variant: "destructive",
      });
    }
  });

  return {
    connections,
    isLoadingConnections,
    connectionsError,
    connectingProvider,
    startConnect: (provider: HealthProvider) => startAuthFlowMutation.mutate(provider),
    updateConnection: (connectionId: number, syncEnabled: boolean) => 
      updateConnectionMutation.mutate({ connectionId, syncEnabled }),
    deleteConnection: (connectionId: number) => deleteConnectionMutation.mutate(connectionId),
    syncHealthData: (options?: { dataType?: HealthDataType, provider?: HealthProvider }) => 
      syncHealthDataMutation.mutate(options || {}),
    isConnecting: startAuthFlowMutation.isPending,
    isUpdating: updateConnectionMutation.isPending,
    isDeleting: deleteConnectionMutation.isPending,
    isSyncing: syncHealthDataMutation.isPending,
  };
}