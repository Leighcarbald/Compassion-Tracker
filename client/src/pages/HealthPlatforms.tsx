import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, RefreshCw, Trash2, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import Header from '@/components/Header';
import { useCareRecipient } from '@/hooks/use-care-recipient';
import { useHealthPlatforms, HealthProvider, HealthPlatformConnection } from '@/hooks/use-health-platforms';
import { useHealthWebSocket } from '@/hooks/use-health-websocket';
import { SiGooglefit, SiApple, SiFitbit, SiSamsung, SiGarmin } from 'react-icons/si';
import { Link } from 'wouter';

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

const dataTypeNames = {
  sleep: 'Sleep',
  bloodPressure: 'Blood Pressure',
  glucose: 'Glucose Levels',
  heartRate: 'Heart Rate',
  activity: 'Activity',
};

export default function HealthPlatforms() {
  const [selectedTab, setSelectedTab] = useState<string>('connected');
  const [connectionToDelete, setConnectionToDelete] = useState<HealthPlatformConnection | null>(null);
  const { selectedCareRecipient } = useCareRecipient();
  const { 
    connections, 
    isLoadingConnections, 
    startConnect, 
    updateConnection, 
    deleteConnection, 
    syncHealthData,
    isConnecting,
    isUpdating,
    isDeleting,
    isSyncing,
  } = useHealthPlatforms(selectedCareRecipient?.id);
  
  // Connect to WebSocket for real-time health data updates
  const { status: wsStatus } = useHealthWebSocket({
    careRecipientId: selectedCareRecipient?.id,
  });
  
  const platforms: HealthProvider[] = ['google', 'apple', 'fitbit', 'samsung', 'garmin'];
  const availablePlatforms = platforms.filter(
    platform => !connections?.some(conn => conn.provider === platform)
  );
  
  if (!selectedCareRecipient) {
    return (
      <div className="container py-6">
        <Header title="Health Platforms" />
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Please select a care recipient first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container py-6">
      <Header title="Health Platforms">
        <Badge 
          variant={wsStatus === 'connected' ? 'default' : 'destructive'}
          className="ml-2"
        >
          {wsStatus === 'connected' ? 'Live Updates On' : 'Live Updates Off'}
        </Badge>
      </Header>
      
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Connected Health Platforms</span>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => syncHealthData()}
              disabled={isSyncing || !connections?.length}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync All Data'}
            </Button>
          </CardTitle>
          <CardDescription>
            Connect your health platforms to automatically import data like sleep, blood pressure, and more.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="connected">Connected Platforms</TabsTrigger>
              <TabsTrigger value="available">Available Platforms</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connected">
              {isLoadingConnections ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : connections?.length ? (
                <div className="space-y-4">
                  {connections.map(connection => {
                    const IconComponent = platformIcons[connection.provider];
                    return (
                      <div key={connection.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <IconComponent className="h-6 w-6 mr-3" />
                            <div>
                              <h3 className="font-medium">{platformNames[connection.provider]}</h3>
                              <p className="text-sm text-muted-foreground">
                                Connected {format(new Date(connection.createdAt), 'PPP')}
                              </p>
                              {connection.lastSynced && (
                                <p className="text-xs text-muted-foreground">
                                  Last sync: {format(new Date(connection.lastSynced), 'PPP p')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm">Sync</span>
                              <Switch 
                                checked={connection.syncEnabled} 
                                onCheckedChange={(checked) => updateConnection(connection.id, checked)}
                                disabled={isUpdating}
                              />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setConnectionToDelete(connection)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        
                        <Separator className="my-3" />
                        
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => syncHealthData({ provider: connection.provider, dataType: 'sleep' })}
                            disabled={isSyncing || !connection.syncEnabled}
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                            Sync Sleep
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => syncHealthData({ provider: connection.provider, dataType: 'bloodPressure' })}
                            disabled={isSyncing || !connection.syncEnabled}
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                            Sync Blood Pressure
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No health platforms connected.</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setSelectedTab('available')}
                  >
                    Connect a Platform
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="available">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availablePlatforms.length > 0 ? (
                  availablePlatforms.map(platform => {
                    const IconComponent = platformIcons[platform];
                    return (
                      <div key={platform} className="border rounded-lg p-4">
                        <div className="flex items-center">
                          <IconComponent className="h-6 w-6 mr-3" />
                          <div>
                            <h3 className="font-medium">{platformNames[platform]}</h3>
                            <p className="text-sm text-muted-foreground">
                              Import health data automatically
                            </p>
                          </div>
                        </div>
                        
                        <Separator className="my-3" />
                        
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-muted-foreground">
                            <ul className="list-disc list-inside">
                              {platform === 'google' && (
                                <>
                                  <li>Sleep tracking</li>
                                  <li>Blood pressure</li>
                                  <li>Activity data</li>
                                </>
                              )}
                              {platform === 'apple' && (
                                <>
                                  <li>Sleep tracking</li>
                                  <li>Heart rate</li>
                                  <li>Blood glucose</li>
                                </>
                              )}
                              {platform === 'fitbit' && (
                                <>
                                  <li>Sleep tracking</li>
                                  <li>Heart rate</li>
                                </>
                              )}
                              {(platform === 'samsung' || platform === 'garmin') && (
                                <>
                                  <li>Sleep tracking</li>
                                  <li>Activity data</li>
                                </>
                              )}
                            </ul>
                          </div>
                          <Button 
                            onClick={() => startConnect(platform)}
                            disabled={isConnecting}
                          >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Connect
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 col-span-2">
                    <p className="text-muted-foreground">All available health platforms are already connected.</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setSelectedTab('connected')}
                    >
                      View Connected Platforms
                    </Button>
                  </div>
                )}
              </div>
              
              {isConnecting && (
                <div className="mt-6 p-4 border border-blue-300 bg-blue-50 rounded-md">
                  <p className="text-center text-blue-800 flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Connecting to platform... You'll be redirected to authorize access.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
        
        <CardFooter className="flex-col items-start border-t pt-6">
          <h3 className="font-medium mb-2">What data is imported?</h3>
          <p className="text-sm text-muted-foreground mb-1">
            When you connect a health platform, we can automatically import:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside">
            <li>Sleep records (duration, quality, and patterns)</li>
            <li>Blood pressure readings</li>
            <li>Heart rate measurements</li>
            <li>Physical activity and exercise</li>
            <li>Blood glucose levels (where available)</li>
          </ul>
          
          <p className="text-sm mt-4">
            <Link to="/sleep" className="text-primary hover:underline">View Sleep Page</Link> or{' '}
            <Link to="/blood-pressure" className="text-primary hover:underline">Blood Pressure Page</Link> to see your imported data.
          </p>
        </CardFooter>
      </Card>
      
      {/* Delete Connection Confirmation */}
      <AlertDialog open={!!connectionToDelete} onOpenChange={() => setConnectionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove health platform connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect {
                connectionToDelete ? platformNames[connectionToDelete.provider] : ''
              } and stop automatic data import. Your existing data will remain in the app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (connectionToDelete) {
                  deleteConnection(connectionToDelete.id);
                  setConnectionToDelete(null);
                }
              }}
            >
              Remove Connection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Success and Error pages for OAuth callbacks */}
      <div className="hidden">
        {/* These routes will be defined in the App component */}
      </div>
    </div>
  );
}