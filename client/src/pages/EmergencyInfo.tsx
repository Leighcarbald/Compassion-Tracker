import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import BottomNavigation from "@/components/BottomNavigation";
import { TabType } from "@/lib/types";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Plus } from "lucide-react";
import { useCareRecipient } from "@/hooks/use-care-recipient";
import PageHeader from "@/components/PageHeader";

interface EmergencyInfoProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function EmergencyInfo({ activeTab, setActiveTab }: EmergencyInfoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const { activeCareRecipientId } = useCareRecipient();
  
  // Fetch care recipients for dropdown
  const careRecipientsQuery = useQuery({
    queryKey: ["/api/care-recipients"],
  });

  // Fetch emergency info for selected care recipient
  const { data: emergencyInfoResponse, isLoading, error: emergencyInfoError } = useQuery({
    queryKey: ["/api/emergency-info", activeCareRecipientId],
    enabled: !!activeCareRecipientId
  });
  
  console.log("EmergencyInfo response:", emergencyInfoResponse);
  
  // We have to determine if we need to create a new record
  const needsCreation = emergencyInfoResponse?.needsCreation || 
                        emergencyInfoResponse?.status === 'not_found' ||
                        (Array.isArray(emergencyInfoResponse?.emergencyInfo) && 
                         emergencyInfoResponse?.emergencyInfo.length === 0);

  // Handle starting the creation process
  const handleCreateEmergencyInfo = () => {
    toast({
      title: "Create Emergency Information",
      description: "This feature will be implemented soon",
      duration: 3000,
    });
    setIsEditing(true);
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-50">
      <main className="flex-1 pb-16">
        <PageHeader 
          title="Emergency Information" 
          icon={<ShieldAlert className="h-6 w-6 text-red-500" />}
        />
        
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-gray-500">Loading emergency information...</p>
            </div>
          ) : emergencyInfoError ? (
            <div className="bg-red-50 border border-red-200 p-4 rounded-md text-red-700">
              Error loading emergency information
            </div>
          ) : needsCreation ? (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <ShieldAlert className="h-5 w-5 mr-2 text-orange-500" /> 
                  No Emergency Information
                </CardTitle>
                <CardDescription>
                  You need to create emergency information for this care recipient
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  No emergency information has been created yet. Emergency information 
                  contains critical details that may be needed in case of an emergency.
                </p>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="w-full" 
                  onClick={handleCreateEmergencyInfo}
                >
                  <Plus className="h-4 w-4 mr-2" /> Create Emergency Information
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-green-50 border border-green-200 p-4 rounded-md text-green-700">
              Emergency information exists! This view will be enhanced soon.
            </div>
          )}
        </div>
      </main>
      
      <BottomNavigation activeTab={activeTab} onChangeTab={setActiveTab} />
    </div>
  );
}