import { useState, useRef, useEffect } from "react";
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
  
  // Update existing emergency info
  const updateEmergencyInfoMutation = useMutation({
    mutationFn: async (formData: any) => {
      const response = await apiRequest("PATCH", `/api/emergency-info/${formData.id}`, formData);
      const data = await response.json();
      console.log("Emergency info update response:", data);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Emergency info updated",
        description: "Emergency information was updated successfully"
      });
      
      // Refetch emergency info
      queryClient.invalidateQueries({
        queryKey: ["/api/emergency-info", activeCareRecipientId]
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating emergency info",
        description: error.message,
        variant: "destructive"
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
        { 
          pin: params.pin,
          careRecipientId: activeCareRecipientId 
        }
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
        { 
          pin: params.pin,
          careRecipientId: activeCareRecipientId
        }
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
    
    // Just create directly without the form for now
    // This works around the form rendering issue
    createEmergencyInfoMutation.mutate({
      careRecipientId: activeCareRecipientId,
      allergies: "None",
      bloodType: "Unknown",
      medicationAllergies: "None known",
      advanceDirectives: false,
      dnrOrder: false,
      additionalInfo: ""
    });
  };

  // Find the current care recipient's name
  const selectedCareRecipient = careRecipientsQuery.data ? 
    careRecipientsQuery.data.find(
      (recipient: any) => recipient.id === activeCareRecipientId
    ) : null;

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
                        variant="default" 
                        size="sm" 
                        className="w-full"
                        onClick={handleVerifyPin}
                        disabled={verifyPinMutation.isPending}
                      >
                        {verifyPinMutation.isPending ? (
                          "Verifying..."
                        ) : (
                          <>
                            <Unlock className="h-4 w-4 mr-2" /> Unlock Information
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 flex justify-between items-center">
                      <p className="text-sm text-green-600 flex items-center">
                        <Unlock className="h-4 w-4 mr-1" /> 
                        Information unlocked
                      </p>
                      
                      {!isSettingPin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsSettingPin(true)}
                          className="text-xs px-2 h-7"
                        >
                          Change PIN
                        </Button>
                      )}
                    </div>
                    
                    {isSettingPin ? (
                      <div className="space-y-3 mb-6 p-3 border border-gray-200 rounded-md bg-gray-50">
                        <h3 className="text-sm font-medium">Set New PIN</h3>
                        <p className="text-xs text-gray-600 mb-2">PIN must be exactly 6 digits</p>
                        
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <Input
                              type={showNewPin ? "text" : "password"}
                              placeholder="New PIN (6 digits)"
                              value={newPin}
                              onChange={(e) => setNewPin(e.target.value)}
                              maxLength={6}
                              className="pr-10"
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
                          
                          <Input
                            type={showNewPin ? "text" : "password"}
                            placeholder="Confirm PIN"
                            value={confirmPin}
                            onChange={(e) => setConfirmPin(e.target.value)}
                            maxLength={6}
                          />
                          
                          <div className="flex gap-2 pt-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              onClick={() => {
                                setIsSettingPin(false);
                                setNewPin("");
                                setConfirmPin("");
                              }}
                            >
                              Cancel
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="flex-1"
                              onClick={handleSetPin}
                              disabled={setPinMutation.isPending}
                            >
                              {setPinMutation.isPending ? "Saving..." : "Save PIN"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    
                    <div className="flex flex-col gap-1 mb-2 text-[10px]">
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr>
                            <td className="py-1 px-2 font-medium w-1/3">Date of Birth:</td>
                            <td className="py-1 px-2 bg-gray-50">{data?.emergencyInfo?.dateOfBirth || "Not provided"}</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-medium">SSN:</td>
                            <td className="py-1 px-2 bg-gray-50">{data?.emergencyInfo?.socialSecurityNumber || "Not provided"}</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-medium">Blood Type:</td>
                            <td className="py-1 px-2 bg-gray-50">{data?.emergencyInfo?.bloodType || "Unknown"}</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-medium">Allergies:</td>
                            <td className="py-1 px-2 bg-gray-50">{data?.emergencyInfo?.allergies || "None"}</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-medium">Med Allergies:</td>
                            <td className="py-1 px-2 bg-gray-50">{data?.emergencyInfo?.medicationAllergies || "None"}</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-medium">Insurance:</td>
                            <td className="py-1 px-2 bg-gray-50">{data?.emergencyInfo?.insuranceProvider || "Not provided"}</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-medium">Policy/Group:</td>
                            <td className="py-1 px-2 bg-gray-50">
                              {data?.emergencyInfo?.insurancePolicyNumber ? `Policy: ${data.emergencyInfo.insurancePolicyNumber}` : ""}
                              {data?.emergencyInfo?.insuranceGroupNumber ? `, Group: ${data.emergencyInfo.insuranceGroupNumber}` : ""}
                              {!data?.emergencyInfo?.insurancePolicyNumber && !data?.emergencyInfo?.insuranceGroupNumber && "Not provided"}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-medium">Primary Contact:</td>
                            <td className="py-1 px-2 bg-gray-50">
                              {data?.emergencyInfo?.emergencyContact1Name || "Not provided"}
                              {data?.emergencyInfo?.emergencyContact1Phone ? ` • ${data.emergencyInfo.emergencyContact1Phone}` : ""}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-medium">DNR/Directives:</td>
                            <td className="py-1 px-2 bg-gray-50">
                              {data?.emergencyInfo?.dnrOrder ? "DNR: Yes" : "DNR: No"}
                              {" • "}
                              {data?.emergencyInfo?.advanceDirectives ? "Advance Directives: Yes" : "Advance Directives: No"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-6">
                      <div className="flex flex-col gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => {
                            // Open a simplified edit form
                            setIsEditing(true);
                          }}
                        >
                          Edit Information
                        </Button>
                        
                        {isEditing && (
                          <div className="mt-4 p-3 border border-gray-200 rounded-md bg-gray-50">
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="text-sm font-medium">Edit Emergency Information</h3>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsEditing(false)}
                                className="h-6 w-6 p-0"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                <span className="sr-only">Close</span>
                              </Button>
                            </div>
                            
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium mb-1">Allergies</label>
                                <Input
                                  placeholder="Enter allergies"
                                  defaultValue={data?.emergencyInfo?.allergies || ""}
                                  className="text-sm"
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      allergies: e.target.value
                                    }));
                                  }}
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs font-medium mb-1">Medication Allergies</label>
                                <Input
                                  placeholder="Enter medication allergies"
                                  defaultValue={data?.emergencyInfo?.medicationAllergies || ""}
                                  className="text-sm"
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      medicationAllergies: e.target.value
                                    }));
                                  }}
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs font-medium mb-1">Blood Type</label>
                                <Input
                                  placeholder="Enter blood type"
                                  defaultValue={data?.emergencyInfo?.bloodType || ""}
                                  className="text-sm"
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      bloodType: e.target.value
                                    }));
                                  }}
                                />
                              </div>
                              
                              <div className="flex justify-end gap-2 mt-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsEditing(false)}
                                >
                                  Cancel
                                </Button>
                                
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => {
                                    // Only update with changed fields
                                    if (data?.emergencyInfo?.id) {
                                      const updatedInfo = {
                                        id: data.emergencyInfo.id,
                                        careRecipientId: activeCareRecipientId,
                                        ...(formData.allergies !== undefined && { allergies: formData.allergies }),
                                        ...(formData.medicationAllergies !== undefined && { medicationAllergies: formData.medicationAllergies }),
                                        ...(formData.bloodType !== undefined && { bloodType: formData.bloodType })
                                      };
                                      
                                      updateEmergencyInfoMutation.mutate(updatedInfo);
                                      
                                      toast({
                                        title: "Saving changes",
                                        description: "Emergency information is being updated"
                                      });
                                      
                                      // Reset form and close edit panel
                                      setTimeout(() => {
                                        setIsEditing(false);
                                      }, 500);
                                    }
                                  }}
                                  disabled={updateEmergencyInfoMutation.isPending}
                                >
                                  {updateEmergencyInfoMutation.isPending ? "Saving..." : "Save Changes"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
      
      <BottomNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}