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
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/emergency-info", activeCareRecipientId],
    queryFn: async () => {
      if (!activeCareRecipientId) return null;
      const response = await apiRequest("GET", `/api/emergency-info?careRecipientId=${activeCareRecipientId}`);
      const data = await response.json();
      console.log("Emergency info response:", data);
      return data;
    },
    enabled: !!activeCareRecipientId
  });
  
  // Create emergency info mutation
  const createEmergencyInfoMutation = useMutation({
    mutationFn: async (formData: any) => {
      const response = await apiRequest("POST", "/api/emergency-info", formData);
      return await response.json();
    },
    onSuccess: (data) => {
      console.log("Emergency info created:", data);
      toast({
        title: "Emergency information created",
        description: "The emergency information has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/emergency-info", activeCareRecipientId] });
    },
    onError: (error: Error) => {
      console.error("Error creating emergency info:", error);
      toast({
        title: "Error creating emergency information",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Check if we need to create a new record
  console.log("Emergency data status:", data);
  const needsCreation = 
    !data || 
    data.status === 'not_found' || 
    (data.needsCreation === true) ||
    (data.emergencyInfo && Array.isArray(data.emergencyInfo) && data.emergencyInfo.length === 0);
  
  // Emergency info exists if data has a success status
  const infoExists = data && data.status === 'success';

  // Handle starting the creation process
  const handleCreateEmergencyInfo = () => {
    if (!activeCareRecipientId) {
      toast({
        title: "No care recipient selected",
        description: "Please select a care recipient first",
        variant: "destructive"
      });
      return;
    }
    
    // Create basic emergency info with empty fields that can be filled in later
    createEmergencyInfoMutation.mutate({
      careRecipientId: activeCareRecipientId,
      allergies: "None",
      bloodType: "Unknown",
      medicationAllergies: "None known",
      advanceDirectives: false, // Boolean field
      dnrOrder: false, // Boolean field
      additionalInfo: "",
      // Not including fields that don't exist in the schema
      // to prevent errors
    });
  };

  // Find the current care recipient's name
  const selectedCareRecipient = careRecipientsQuery.data?.find(
    (recipient: any) => recipient.id === activeCareRecipientId
  );

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-50">
      <main className="flex-1 pb-16">
        <PageHeader 
          title="Emergency Information" 
          icon={<ShieldAlert className="h-6 w-6 text-red-500" />}
        />
        
        <div className="p-4">
          {!activeCareRecipientId ? (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">No Care Recipient Selected</CardTitle>
                <CardDescription>
                  Please select a care recipient first
                </CardDescription>
              </CardHeader>
            </Card>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-gray-500">Loading emergency information...</p>
            </div>
          ) : error ? (
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
                  Create emergency information for {selectedCareRecipient?.name || "this care recipient"}
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
                  disabled={createEmergencyInfoMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" /> 
                  {createEmergencyInfoMutation.isPending 
                    ? "Creating..." 
                    : "Create Emergency Information"}
                </Button>
              </CardContent>
            </Card>
          ) : data?.status === "success" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <ShieldAlert className="h-5 w-5 mr-2 text-green-500" /> 
                  Emergency Information
                </CardTitle>
                <CardDescription>
                  Emergency info for {selectedCareRecipient?.name || "this care recipient"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Allergies</h3>
                    <p className="text-sm text-gray-600">{data?.emergencyInfo?.allergies || "None"}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium">Medication Allergies</h3>
                    <p className="text-sm text-gray-600">{data?.emergencyInfo?.medicationAllergies || "None known"}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium">Blood Type</h3>
                    <p className="text-sm text-gray-600">{data?.emergencyInfo?.bloodType || "Unknown"}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium">Advance Directives</h3>
                    <p className="text-sm text-gray-600">{data?.emergencyInfo?.advanceDirectives ? "Yes" : "No"}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium">DNR Order</h3>
                    <p className="text-sm text-gray-600">{data?.emergencyInfo?.dnrOrder ? "Yes" : "No"}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium">Additional Information</h3>
                    <p className="text-sm text-gray-600">{data?.emergencyInfo?.additionalInfo || "None"}</p>
                  </div>
                </div>
                
                <div className="mt-6">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    disabled={true}
                  >
                    Edit Emergency Information (Coming Soon)
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <ShieldAlert className="h-5 w-5 mr-2 text-red-500" /> 
                  Error Loading Emergency Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  There was a problem loading the emergency information. Please try again.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/emergency-info", activeCareRecipientId] });
                  }}
                >
                  Reload
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      
      <BottomNavigation activeTab={activeTab} onChangeTab={setActiveTab} />
    </div>
  );
}