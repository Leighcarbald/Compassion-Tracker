import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import BottomNavigation from "@/components/BottomNavigation";
import { TabType } from "@/lib/types";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Plus, Lock, Unlock, Eye, EyeOff, XCircle, Save } from "lucide-react";
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
  
  // Form state for emergency info editing
  const [formData, setFormData] = useState({
    dateOfBirth: "",
    socialSecurityNumber: "",
    allergies: "",
    medicationAllergies: "",
    bloodType: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",
    insuranceGroupNumber: "",
    emergencyContact1Name: "",
    emergencyContact1Relation: "",
    emergencyContact1Phone: "",
    emergencyContact2Name: "",
    emergencyContact2Relation: "",
    emergencyContact2Phone: "",
    advanceDirectives: false,
    dnrOrder: false,
    additionalInfo: ""
  });
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
      
      // Reset form
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating emergency info",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Load data into form when editing
  useEffect(() => {
    if (isEditing && data?.emergencyInfo) {
      const info = data.emergencyInfo;
      setFormData({
        dateOfBirth: info.dateOfBirth || "",
        socialSecurityNumber: info.socialSecurityNumber || "",
        allergies: info.allergies || "",
        medicationAllergies: info.medicationAllergies || "",
        bloodType: info.bloodType || "",
        insuranceProvider: info.insuranceProvider || "",
        insurancePolicyNumber: info.insurancePolicyNumber || "",
        insuranceGroupNumber: info.insuranceGroupNumber || "",
        emergencyContact1Name: info.emergencyContact1Name || "",
        emergencyContact1Relation: info.emergencyContact1Relation || "",
        emergencyContact1Phone: info.emergencyContact1Phone || "",
        emergencyContact2Name: info.emergencyContact2Name || "",
        emergencyContact2Relation: info.emergencyContact2Relation || "",
        emergencyContact2Phone: info.emergencyContact2Phone || "",
        advanceDirectives: !!info.advanceDirectives,
        dnrOrder: !!info.dnrOrder,
        additionalInfo: info.additionalInfo || ""
      });
    }
  }, [isEditing, data]);
  
  // Handle form field changes
  const handleFormChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Handle form submission for editing
  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!data?.emergencyInfo?.id) {
      toast({
        title: "Error",
        description: "No emergency information ID found for updating",
        variant: "destructive"
      });
      return;
    }
    
    // Include care recipient ID and existing record ID
    updateEmergencyInfoMutation.mutate({
      ...formData,
      id: data.emergencyInfo.id,
      careRecipientId: activeCareRecipientId
    });
  };
  
  // Handle form submission for both creating and editing
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeCareRecipientId) {
      toast({
        title: "Error",
        description: "Please select a care recipient first",
        variant: "destructive"
      });
      return;
    }
    
    if (data?.emergencyInfo?.id) {
      // Update existing record
      updateEmergencyInfoMutation.mutate({
        ...formData,
        id: data.emergencyInfo.id,
        careRecipientId: activeCareRecipientId
      });
    } else {
      // Create new record
      createEmergencyInfoMutation.mutate({
        ...formData,
        careRecipientId: activeCareRecipientId
      });
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
    
    // Either create immediately or open edit form to create
    if (isEditing) {
      // The edit form is already open - the submit handler will create
      toast({
        title: "Ready to create",
        description: "Fill out the form and click Save to create emergency information"
      });
    } else {
      // Open edit form to create new record
      setIsEditing(true);
      
      // Reset form data to defaults since we're creating new
      setFormData({
        dateOfBirth: "",
        socialSecurityNumber: "",
        allergies: "None",
        medicationAllergies: "None known",
        bloodType: "",
        insuranceProvider: "",
        insurancePolicyNumber: "",
        insuranceGroupNumber: "",
        emergencyContact1Name: "",
        emergencyContact1Relation: "",
        emergencyContact1Phone: "",
        emergencyContact2Name: "",
        emergencyContact2Relation: "",
        emergencyContact2Phone: "",
        advanceDirectives: false,
        dnrOrder: false,
        additionalInfo: ""
      });
    }
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
                        onClick={() => setIsEditing(true)}
                      >
                        Edit Emergency Information
                      </Button>
                      
                      {isEditing && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                            <CardHeader>
                              <CardTitle className="flex items-center">
                                <ShieldAlert className="h-5 w-5 mr-2 text-orange-500" />
                                Edit Emergency Information
                              </CardTitle>
                              <CardDescription>Update emergency information for {selectedCareRecipient?.name || "this care recipient"}</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <form onSubmit={handleSubmitForm} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                                    <Input
                                      id="dateOfBirth"
                                      type="date"
                                      value={formData.dateOfBirth} 
                                      onChange={(e) => handleFormChange('dateOfBirth', e.target.value)}
                                      placeholder="YYYY-MM-DD"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="socialSecurityNumber">Social Security Number</Label>
                                    <Input
                                      id="socialSecurityNumber"
                                      value={formData.socialSecurityNumber}
                                      onChange={(e) => handleFormChange('socialSecurityNumber', e.target.value)}
                                      placeholder="XXX-XX-XXXX"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="allergies">Allergies</Label>
                                    <Textarea
                                      id="allergies"
                                      value={formData.allergies}
                                      onChange={(e) => handleFormChange('allergies', e.target.value)}
                                      placeholder="Enter allergies"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="medicationAllergies">Medication Allergies</Label>
                                    <Textarea
                                      id="medicationAllergies"
                                      value={formData.medicationAllergies}
                                      onChange={(e) => handleFormChange('medicationAllergies', e.target.value)}
                                      placeholder="Enter medication allergies"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="bloodType">Blood Type</Label>
                                    <Select 
                                      value={formData.bloodType} 
                                      onValueChange={(value) => handleFormChange('bloodType', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select Blood Type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="">Unknown</SelectItem>
                                        <SelectItem value="A+">A+</SelectItem>
                                        <SelectItem value="A-">A-</SelectItem>
                                        <SelectItem value="B+">B+</SelectItem>
                                        <SelectItem value="B-">B-</SelectItem>
                                        <SelectItem value="AB+">AB+</SelectItem>
                                        <SelectItem value="AB-">AB-</SelectItem>
                                        <SelectItem value="O+">O+</SelectItem>
                                        <SelectItem value="O-">O-</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="insuranceProvider">Insurance Provider</Label>
                                    <Input
                                      id="insuranceProvider"
                                      value={formData.insuranceProvider}
                                      onChange={(e) => handleFormChange('insuranceProvider', e.target.value)}
                                      placeholder="Enter insurance provider"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="insurancePolicyNumber">Policy Number</Label>
                                    <Input
                                      id="insurancePolicyNumber"
                                      value={formData.insurancePolicyNumber}
                                      onChange={(e) => handleFormChange('insurancePolicyNumber', e.target.value)}
                                      placeholder="Enter policy number"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="insuranceGroupNumber">Group Number</Label>
                                    <Input
                                      id="insuranceGroupNumber"
                                      value={formData.insuranceGroupNumber}
                                      onChange={(e) => handleFormChange('insuranceGroupNumber', e.target.value)}
                                      placeholder="Enter group number"
                                    />
                                  </div>
                                
                                  <div className="space-y-2">
                                    <Label htmlFor="emergencyContact1Name">Emergency Contact 1 Name</Label>
                                    <Input
                                      id="emergencyContact1Name"
                                      value={formData.emergencyContact1Name}
                                      onChange={(e) => handleFormChange('emergencyContact1Name', e.target.value)}
                                      placeholder="Enter name"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="emergencyContact1Relation">Relation</Label>
                                    <Input
                                      id="emergencyContact1Relation"
                                      value={formData.emergencyContact1Relation}
                                      onChange={(e) => handleFormChange('emergencyContact1Relation', e.target.value)}
                                      placeholder="e.g. Spouse, Child"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="emergencyContact1Phone">Phone</Label>
                                    <Input
                                      id="emergencyContact1Phone"
                                      value={formData.emergencyContact1Phone}
                                      onChange={(e) => handleFormChange('emergencyContact1Phone', e.target.value)}
                                      placeholder="(XXX) XXX-XXXX"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="emergencyContact2Name">Emergency Contact 2 Name</Label>
                                    <Input
                                      id="emergencyContact2Name"
                                      value={formData.emergencyContact2Name}
                                      onChange={(e) => handleFormChange('emergencyContact2Name', e.target.value)}
                                      placeholder="Enter name"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="emergencyContact2Relation">Relation</Label>
                                    <Input
                                      id="emergencyContact2Relation"
                                      value={formData.emergencyContact2Relation}
                                      onChange={(e) => handleFormChange('emergencyContact2Relation', e.target.value)}
                                      placeholder="e.g. Sibling, Friend"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="emergencyContact2Phone">Phone</Label>
                                    <Input
                                      id="emergencyContact2Phone"
                                      value={formData.emergencyContact2Phone}
                                      onChange={(e) => handleFormChange('emergencyContact2Phone', e.target.value)}
                                      placeholder="(XXX) XXX-XXXX"
                                    />
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      id="advanceDirectives"
                                      checked={formData.advanceDirectives}
                                      onCheckedChange={(checked) => handleFormChange('advanceDirectives', checked)}
                                    />
                                    <Label htmlFor="advanceDirectives">Has Advance Directives</Label>
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      id="dnrOrder"
                                      checked={formData.dnrOrder}
                                      onCheckedChange={(checked) => handleFormChange('dnrOrder', checked)}
                                    />
                                    <Label htmlFor="dnrOrder">Has DNR Order</Label>
                                  </div>
                                </div>
                                
                                <div className="space-y-2 col-span-2">
                                  <Label htmlFor="additionalInfo">Additional Information</Label>
                                  <Textarea
                                    id="additionalInfo"
                                    value={formData.additionalInfo}
                                    onChange={(e) => handleFormChange('additionalInfo', e.target.value)}
                                    placeholder="Enter additional information"
                                    rows={4}
                                  />
                                </div>
                                
                                <div className="flex justify-end space-x-3 pt-4">
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => setIsEditing(false)}
                                    className="flex items-center"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancel
                                  </Button>
                                  <Button 
                                    type="submit"
                                    className="flex items-center"
                                    disabled={updateEmergencyInfoMutation.isPending}
                                  >
                                    <Save className="h-4 w-4 mr-2" />
                                    {updateEmergencyInfoMutation.isPending ? "Saving..." : "Save Changes"}
                                  </Button>
                                </div>
                              </form>
                            </CardContent>
                          </Card>
                        </div>
                      )}
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