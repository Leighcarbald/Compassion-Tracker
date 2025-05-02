import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { SiGooglefit, SiApple, SiFitbit, SiSamsung, SiGarmin } from 'react-icons/si';
import { useHealthPlatforms, HealthDataType } from '@/hooks/use-health-platforms';
import { useCareRecipient } from '@/hooks/use-care-recipient';
import { useHealthWebSocket } from '@/hooks/use-health-websocket';

const platformIcons = {
  google: SiGooglefit,
  apple: SiApple,
  fitbit: SiFitbit,
  samsung: SiSamsung,
  garmin: SiGarmin,
};

const platformNames = {
  google: 'Google Fit',
  apple: 'Apple Health',
  fitbit: 'Fitbit',
  samsung: 'Samsung Health',
  garmin: 'Garmin Connect',
};

interface HealthPlatformStatusProps {
  dataType: HealthDataType;
}

export function HealthPlatformStatus({ dataType }: HealthPlatformStatusProps) {
  const { selectedCareRecipient } = useCareRecipient();
  const { 
    connections, 
    isLoadingConnections, 
    syncHealthData,
    isSyncing,
  } = useHealthPlatforms(selectedCareRecipient?.id);
  
  // Connect to WebSocket
  const { isConnected: wsConnected } = useHealthWebSocket({
    careRecipientId: selectedCareRecipient?.id,
  });
  
  // If no care recipient is selected, don't show anything
  if (!selectedCareRecipient) {
    return null;
  }
  
  // If loading, show a simple loading state
  if (isLoadingConnections) {
    return (
      <Card className="mb-4">
        <CardContent className="py-3 flex items-center justify-between">
          <div className="animate-pulse h-5 w-48 bg-muted rounded"></div>
          <div className="animate-pulse h-8 w-20 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }
  
  // If no connections, show a prompt to connect
  if (!connections?.length) {
    return (
      <Alert className="mb-4">
        <AlertTitle>
          Import Health Data Automatically
        </AlertTitle>
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span>Connect your health platforms to automatically import {dataType === 'sleep' ? 'sleep data' : 'health metrics'}.</span>
          <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
            <Link to="/health-platforms">
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Platforms
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  
  // Find connections that support this data type
  const supportedConnections = connections.filter(connection => {
    if (dataType === 'sleep') {
      // All platforms support sleep
      return true;
    } else if (dataType === 'bloodPressure') {
      // Only Google Fit supports blood pressure
      return connection.provider === 'google';
    } else if (dataType === 'glucose') {
      // Only Apple Health supports glucose
      return connection.provider === 'apple';
    }
    return false;
  });
  
  if (!supportedConnections.length) {
    return (
      <Alert className="mb-4">
        <AlertTitle>
          No Compatible Health Platforms
        </AlertTitle>
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span>
            {dataType === 'bloodPressure' 
              ? 'Blood pressure import is currently only available with Google Fit.' 
              : dataType === 'glucose'
              ? 'Glucose data import is currently only available with Apple Health.'
              : 'None of your connected platforms support this data type.'}
          </span>
          <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
            <Link to="/health-platforms">
              <ExternalLink className="h-4 w-4 mr-2" />
              Manage Platforms
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <Card className="mb-4">
      <CardContent className="py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {supportedConnections.map((connection) => {
              const IconComponent = platformIcons[connection.provider];
              return (
                <div 
                  key={connection.id} 
                  className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
                    connection.syncEnabled ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'
                  }`}
                  title={`${platformNames[connection.provider]} ${connection.syncEnabled ? '(Enabled)' : '(Disabled)'}`}
                >
                  <IconComponent className="h-4 w-4" />
                </div>
              );
            })}
          </div>
          
          <div>
            <p className="text-sm font-medium">
              {dataType === 'sleep' 
                ? 'Sleep data imports' 
                : dataType === 'bloodPressure'
                ? 'Blood pressure imports'
                : 'Health data imports'}
              <Badge 
                variant={wsConnected ? 'outline' : 'secondary'} 
                className="ml-2"
              >
                {wsConnected ? 'Live' : 'Offline'}
              </Badge>
            </p>
            <p className="text-xs text-muted-foreground">
              {supportedConnections.filter(c => c.syncEnabled).length} active platform
              {supportedConnections.filter(c => c.syncEnabled).length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => syncHealthData({ dataType })}
          disabled={isSyncing || !supportedConnections.some(c => c.syncEnabled)}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </CardContent>
    </Card>
  );
}