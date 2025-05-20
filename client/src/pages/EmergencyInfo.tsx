import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import BottomNavigation from "@/components/BottomNavigation";
import { TabType } from "@/lib/types";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Plus, Lock, Unlock, Eye, EyeOff } from "lucide-react";
import { useCareRecipient } from "@/hooks/use-care-recipient";
import { usePinAuth } from "@/hooks/use-pin-auth";
import PageHeader from "@/components/PageHeader";

interface EmergencyInfoProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function EmergencyInfo({ activeTab, setActiveTab }: EmergencyInfoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { activeCareRecipientId } = useCareRecipient();
  const { isUnlocked: isPinUnlocked, unlockPin } = usePinAuth();
  
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
  
  // Check if this emergency info is unlocked with PIN
  const emergencyInfoId = data?.emergencyInfo?.id;
  const isInfoUnlocked = emergencyInfoId ? isPinUnlocked(emergencyInfoId.toString()) : false;
  
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
  
  // Handle PIN verification
  const verifyPinMutation = useMutation({
    mutationFn: async (params: { id: number, pin: string }) => {
      const response = await apiRequest(
        "POST", 
        `/api/emergency-info/${params.id}/verify-pin`,
        { pin: params.pin }
      );
      return await response.json();
    },
    onSuccess: (responseData) => {
      if (responseData.success) {
        toast({
          title: "Access granted",
          description: "PIN verified successfully"
        });
        
        // Set as unlocked in pin storage
        if (emergencyInfoId) {
          unlockPin(emergencyInfoId.toString());
          setIsUnlocked(true);
        }
        
        setPin("");
        setIsVerifying(false);
      } else {
        toast({
          title: "Access denied",
          description: "Incorrect PIN",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const handleVerifyPin = () => {
    if (!pin) {
      toast({
        title: "PIN required",
        description: "Please enter a PIN to access emergency information",
        variant: "destructive"
      });
      return;
    }
    
    if (emergencyInfoId) {
      verifyPinMutation.mutate({ id: emergencyInfoId, pin });
    }
  };
  
  // Set PIN mutation
  const setPinMutation = useMutation({
    mutationFn: async (params: { id: number, pin: string }) => {
      const response = await apiRequest(
        "POST", 
        `/api/emergency-info/${params.id}/set-pin`,
        { pin: params.pin }
      );
      return await response.json();
    },
    onSuccess: (responseData) => {
      if (responseData.success) {
        toast({
          title: "PIN set successfully",
          description: "Your emergency information is now protected"
        });
        
        // Set as unlocked in pin storage and update UI state
        if (emergencyInfoId) {
          unlockPin(emergencyInfoId.toString());
          setIsUnlocked(true);
        }
        
        setNewPin("");
        setConfirmPin("");
        setIsSettingPin(false);
      } else {
        toast({
          title: "Error setting PIN",
          description: responseData.message || "An error occurred",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error setting PIN",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const handleSetPin = () => {
    // Validate PIN format - must be 6 digits
    if (!/^\d{6}$/.test(newPin)) {
      toast({
        title: "Invalid PIN format",
        description: "PIN must be exactly 6 digits",
        variant: "destructive"
      });
      return;
    }
    
    // Confirm PIN matches
    if (newPin !== confirmPin) {
      toast({
        title: "PINs don't match",
        description: "The confirmation PIN doesn't match",
        variant: "destructive"
      });
      return;
    }
    
    // Set the PIN
    if (emergencyInfoId) {
      setPinMutation.mutate({ id: emergencyInfoId, pin: newPin });
    }
  };

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
                {!isInfoUnlocked ? (
                  <div className="space-y-4">
                    <div className="bg-amber-50 p-3 rounded-md border border-amber-200 flex items-center mb-4">
                      <Lock className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0" />
                      <p className="text-sm text-amber-800">This information is protected. Please enter the PIN to view.</p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Input
                          type={showPin ? "text" : "password"}
                          placeholder="Enter PIN"
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                          className="pr-10"
                          ref={pinInputRef}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-[-40px]"
                          onClick={() => setShowPin(!showPin)}
                        >
                          {showPin ? (
                            <EyeOff className="h-4 w-4 text-gray-500" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-500" />
                          )}
                        </Button>
                      </div>
                      
                      <Button 
                        onClick={handleVerifyPin}
                        className="w-full"
                        disabled={verifyPinMutation.isPending}
                      >
                        {verifyPinMutation.isPending ? "Verifying..." : "Unlock"}
                      </Button>
                      
                      <p className="text-xs text-gray-500 mt-2">
                        This PIN protects sensitive medical information.
                      </p>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-4"
                        onClick={() => setIsSettingPin(true)}
                      >
                        Set New PIN
                      </Button>
                    </div>
                    
                    {isSettingPin && (
                      <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                        <h3 className="text-sm font-medium mb-3">Set 6-Digit PIN</h3>
                        
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="new-pin" className="text-xs text-gray-700 mb-1 block">
                              New PIN (6 digits)
                            </label>
                            <div className="flex items-center">
                              <Input
                                id="new-pin"
                                type={showNewPin ? "text" : "password"}
                                placeholder="Enter new 6-digit PIN"
                                value={newPin}
                                onChange={(e) => {
                                  // Only allow digits and limit to 6 characters
                                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                  setNewPin(value);
                                }}
                                className="pr-10"
                                inputMode="numeric"
                                pattern="[0-9]*"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="ml-[-40px]"
                                onClick={() => setShowNewPin(!showNewPin)}
                              >
                                {showNewPin ? (
                                  <EyeOff className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <Eye className="h-4 w-4 text-gray-500" />
                                )}
                              </Button>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              PIN must be exactly 6 digits
                            </div>
                          </div>
                          
                          <div>
                            <label htmlFor="confirm-pin" className="text-xs text-gray-700 mb-1 block">
                              Confirm PIN
                            </label>
                            <Input
                              id="confirm-pin"
                              type={showNewPin ? "text" : "password"}
                              placeholder="Confirm 6-digit PIN"
                              value={confirmPin}
                              onChange={(e) => {
                                // Only allow digits and limit to 6 characters
                                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                setConfirmPin(value);
                              }}
                              className="pr-10"
                              inputMode="numeric"
                              pattern="[0-9]*"
                            />
                          </div>
                          
                          <div className="flex space-x-2 mt-2">
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1"
                              onClick={handleSetPin}
                              disabled={setPinMutation.isPending || newPin.length !== 6 || confirmPin.length !== 6}
                            >
                              {setPinMutation.isPending ? "Setting PIN..." : "Save PIN"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsSettingPin(false);
                                setNewPin("");
                                setConfirmPin("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-green-50 p-3 rounded-md border border-green-200 flex items-center mb-4">
                      <Unlock className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                      <p className="text-sm text-green-800">Information unlocked. Sensitive data is now visible.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <h3 className="text-sm font-medium mb-1">Date of Birth</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                          {data?.emergencyInfo?.dateOfBirth || "Not provided"}
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">Social Security Number</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                          {data?.emergencyInfo?.socialSecurityNumber || "Not provided"}
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">Allergies</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                          {data?.emergencyInfo?.allergies || "None"}
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">Medication Allergies</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                          {data?.emergencyInfo?.medicationAllergies || "None known"}
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">Blood Type</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                          {data?.emergencyInfo?.bloodType || "Unknown"}
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">Insurance Provider</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                          {data?.emergencyInfo?.insuranceProvider || "Not provided"}
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">Insurance Policy Number</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                          {data?.emergencyInfo?.insurancePolicyNumber || "Not provided"}
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">Insurance Group Number</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                          {data?.emergencyInfo?.insuranceGroupNumber || "Not provided"}
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">Emergency Contact 1</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                          {data?.emergencyInfo?.emergencyContact1Name 
                            ? `${data?.emergencyInfo?.emergencyContact1Name} (${data?.emergencyInfo?.emergencyContact1Relation || 'Relation not specified'}) - ${data?.emergencyInfo?.emergencyContact1Phone || 'No phone'}`
                            : "Not provided"}
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">Emergency Contact 2</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                          {data?.emergencyInfo?.emergencyContact2Name 
                            ? `${data?.emergencyInfo?.emergencyContact2Name} (${data?.emergencyInfo?.emergencyContact2Relation || 'Relation not specified'}) - ${data?.emergencyInfo?.emergencyContact2Phone || 'No phone'}`
                            : "Not provided"}
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">Advance Directives</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                          {data?.emergencyInfo?.advanceDirectives ? "Yes" : "No"}
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">DNR Order</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                          {data?.emergencyInfo?.dnrOrder ? "Yes" : "No"}
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-1">Additional Information</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 whitespace-pre-wrap">
                          {data?.emergencyInfo?.additionalInfo || "None"}
                        </p>
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
                  </div>
                )}
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