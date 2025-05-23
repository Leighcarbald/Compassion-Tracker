import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Smartphone, 
  Heart, 
  Activity, 
  Droplets, 
  Scale, 
  Moon,
  Settings,
  CheckCircle,
  AlertCircle,
  Plus
} from "lucide-react";
import { useCareRecipient } from "@/hooks/use-care-recipient";

interface DeviceConnection {
  id: string;
  name: string;
  type: string;
  icon: React.ReactNode;
  connected: boolean;
  lastSync?: string;
  metrics: string[];
  description: string;
}

export default function DeviceConnections() {
  const { activeCareRecipientId } = useCareRecipient();
  const [connections, setConnections] = useState<DeviceConnection[]>([
    {
      id: "fitbit",
      name: "Fitbit",
      type: "fitness_tracker",
      icon: <Activity className="h-6 w-6" />,
      connected: false,
      metrics: ["Heart Rate", "Sleep", "Steps", "Activity"],
      description: "Track daily activity, sleep patterns, and heart rate"
    },
    {
      id: "omron",
      name: "Omron Connect",
      type: "blood_pressure",
      icon: <Heart className="h-6 w-6" />,
      connected: false,
      metrics: ["Blood Pressure", "Heart Rate"],
      description: "Automatic blood pressure readings from Omron devices"
    },
    {
      id: "dexcom",
      name: "Dexcom",
      type: "glucose_monitor",
      icon: <Droplets className="h-6 w-6" />,
      connected: false,
      metrics: ["Glucose Levels", "Trends"],
      description: "Continuous glucose monitoring data"
    },
    {
      id: "withings",
      name: "Withings",
      type: "smart_scale",
      icon: <Scale className="h-6 w-6" />,
      connected: false,
      metrics: ["Weight", "Body Composition", "Blood Pressure"],
      description: "Smart scale and health monitoring devices"
    },
    {
      id: "apple_health",
      name: "Apple Health",
      type: "health_platform",
      icon: <Smartphone className="h-6 w-6" />,
      connected: false,
      metrics: ["All Health Data", "Medications", "Vitals"],
      description: "Import data from Apple Health app"
    },
    {
      id: "google_fit",
      name: "Google Fit",
      type: "health_platform",
      icon: <Smartphone className="h-6 w-6" />,
      connected: false,
      metrics: ["Activity", "Heart Rate", "Sleep", "Weight"],
      description: "Import data from Google Fit platform"
    }
  ]);

  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  const handleConnect = (deviceId: string) => {
    // In a real implementation, this would initiate OAuth flow
    setConnections(prev => 
      prev.map(device => 
        device.id === deviceId 
          ? { ...device, connected: true, lastSync: new Date().toLocaleString() }
          : device
      )
    );
  };

  const handleDisconnect = (deviceId: string) => {
    setConnections(prev => 
      prev.map(device => 
        device.id === deviceId 
          ? { ...device, connected: false, lastSync: undefined }
          : device
      )
    );
  };

  if (!activeCareRecipientId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Please select a care recipient to manage device connections.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Device Connections</h1>
        <p className="text-muted-foreground">
          Connect health devices to automatically import health data
        </p>
      </div>

      {/* Auto-sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Sync Settings
          </CardTitle>
          <CardDescription>
            Configure how often data is automatically imported from connected devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Automatic Sync</div>
              <div className="text-sm text-muted-foreground">
                Automatically import new data every hour
              </div>
            </div>
            <Switch 
              checked={autoSyncEnabled}
              onCheckedChange={setAutoSyncEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Connected Devices */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Integrations</h2>
        <div className="grid gap-4">
          {connections.map((device) => (
            <Card key={device.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-muted">
                      {device.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{device.name}</h3>
                        {device.connected ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Not Connected
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {device.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {device.metrics.map((metric) => (
                          <Badge key={metric} variant="outline" className="text-xs">
                            {metric}
                          </Badge>
                        ))}
                      </div>
                      {device.connected && device.lastSync && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last sync: {device.lastSync}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {device.connected ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleConnect(device.id)}
                        >
                          Sync Now
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDisconnect(device.id)}
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => handleConnect(device.id)}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Data Import History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Data Imports</CardTitle>
          <CardDescription>
            View recently imported health data from connected devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No recent imports. Connect a device to start importing health data automatically.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}