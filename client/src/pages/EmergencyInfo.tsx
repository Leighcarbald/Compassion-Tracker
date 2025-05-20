import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";

import BottomNavigation from "@/components/BottomNavigation";
import { TabType } from "@/lib/types";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Save, Plus, Trash2, Edit, Lock, Unlock, Key } from "lucide-react";
import AddCareEventModal from "@/components/AddCareEventModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { EmergencyInfo as EmergencyInfoType } from "@shared/schema";
import PageHeader from "@/components/PageHeader";
import { maskSSN } from "@/lib/utils";

// Use our centralized PIN authentication hook for better state management
import { usePinAuth } from "@/hooks/use-pin-auth";
// Import care recipient context
import { useCareRecipient } from "@/hooks/use-care-recipient";

interface EmergencyInfoProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function EmergencyInfo({ activeTab, setActiveTab }: EmergencyInfoProps) {
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // Start with locked state, but we'll check for authentication in useEffect
  const [isLocked, setIsLocked] = useState(true);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showSetPinDialog, setShowSetPinDialog] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [confirmPinError, setConfirmPinError] = useState("");
  const { toast } = useToast();
  
  // Track initialization status
  const initialLoadRef = useRef(true);

  // Use the PIN authentication context
  const { isUnlocked, unlockPin, lockPin } = usePinAuth();
  
  // Use the global care recipient context
  const { activeCareRecipientId, setActiveCareRecipientId } = useCareRecipient();
  
  // Fetch care recipients for dropdown
  const careRecipientsQuery = useQuery({
    queryKey: ["/api/care-recipients"],
  });

  // Fetch emergency info for selected care recipient
  const { data: emergencyInfoResponse, isLoading, error: emergencyInfoError } = useQuery({
    queryKey: ["/api/emergency-info", activeCareRecipientId],
    enabled: !!activeCareRecipientId
  });
  
  // Extract emergency info from the response, accounting for our new response format
  const emergencyInfo = emergencyInfoResponse?.emergencyInfo?.[0] || null;
  const needsCreation = emergencyInfoResponse?.needsCreation || emergencyInfoResponse?.status === 'not_found';
  
  console.log("EmergencyInfo response:", emergencyInfoResponse);
  console.log("Emergency info exists:", !!emergencyInfo);
  console.log("Needs creation:", needsCreation);

  // Form state for emergency info
  const [formData, setFormData] = useState({
    dateOfBirth: "",
    socialSecurityNumber: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",
    insuranceGroupNumber: "",
    insurancePhone: "",
    emergencyContact1Name: "",
    emergencyContact1Phone: "",
    emergencyContact1Relation: "",
    emergencyContact2Name: "",
    emergencyContact2Phone: "",
    emergencyContact2Relation: "",
    allergies: "",
    medicationAllergies: "",
    bloodType: "",
    advanceDirectives: false,
    dnrOrder: false,
    additionalInfo: ""
  });

  // Update form when emergency info changes
  useEffect(() => {
    if (emergencyInfo) {
      setFormData({
        dateOfBirth: emergencyInfo.dateOfBirth ? new Date(emergencyInfo.dateOfBirth).toISOString().split('T')[0] : "",
        socialSecurityNumber: emergencyInfo.socialSecurityNumber || "",
        insuranceProvider: emergencyInfo.insuranceProvider || "",
        insurancePolicyNumber: emergencyInfo.insurancePolicyNumber || "",
        insuranceGroupNumber: emergencyInfo.insuranceGroupNumber || "",
        insurancePhone: emergencyInfo.insurancePhone || "",
        emergencyContact1Name: emergencyInfo.emergencyContact1Name || "",
        emergencyContact1Phone: emergencyInfo.emergencyContact1Phone || "",
        emergencyContact1Relation: emergencyInfo.emergencyContact1Relation || "",
        emergencyContact2Name: emergencyInfo.emergencyContact2Name || "",
        emergencyContact2Phone: emergencyInfo.emergencyContact2Phone || "",
        emergencyContact2Relation: emergencyInfo.emergencyContact2Relation || "",
        allergies: emergencyInfo.allergies || "",
        medicationAllergies: emergencyInfo.medicationAllergies || "",
        bloodType: emergencyInfo.bloodType || "",
        advanceDirectives: emergencyInfo.advanceDirectives || false,
        dnrOrder: emergencyInfo.dnrOrder || false,
        additionalInfo: emergencyInfo.additionalInfo || ""
      });
    }
  }, [emergencyInfo]);

  // Handle care recipient selection
  const handleCareRecipientChange = (id: string) => {
    setActiveCareRecipientId(id);
    // Reset editing state when changing care recipient
    setIsEditing(false);
    // Reset to locked state initially
    setIsLocked(true);
  };

  // Handle form field changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle checkbox/switch changes
  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Save emergency info mutation
  const saveEmergencyInfoMutation = useMutation({
    mutationFn: async () => {
      if (!activeCareRecipientId) return;
      
      const careRecipientId = parseInt(activeCareRecipientId);
      const payload = {
        ...formData,
        careRecipientId
      };

      if (emergencyInfo) {
        // Update existing record
        return apiRequest("PATCH", `/api/emergency-info/${emergencyInfo.id}`, payload);
      } else {
        // Create new record
        return apiRequest("POST", "/api/emergency-info", payload);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Emergency information saved successfully",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/emergency-info", activeCareRecipientId] });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save emergency information",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    saveEmergencyInfoMutation.mutate();
  };

  const toggleLock = () => {
    if (isLocked) {
      // Need to verify PIN before unlocking
      if (!emergencyInfo?.id) {
        toast({
          title: "Emergency Information",
          description: "You need to create emergency information first",
          duration: 3000,
        });
        // Try to trigger creation by setting edit mode
        setIsEditing(true);
        return;
      }
      
      // If no PIN has been set yet, ask to create one instead of verifying
      if (!emergencyInfo.pinHash) {
        toast({
          title: "PIN Required",
          description: "You need to create a PIN before accessing this information",
          duration: 3000,
        });
        setShowSetPinDialog(true);
        return;
      }
      
      // Show PIN verification dialog
      setShowPinDialog(true);
      setPin("");
      setPinError("");
    } else {
      // Lock the information (this is immediate)
      setIsLocked(true);
      setPin("");
      setPinError("");
      
      // Clear the authenticated state
      if (emergencyInfo?.id) {
        lockPin(emergencyInfo.id);
        
        toast({
          title: "Information Locked",
          description: "Emergency information is now secured with PIN protection",
          duration: 3000,
        });
      }
    }
  };
  
  // Verify PIN mutation
  const verifyPinMutation = useMutation({
    mutationFn: async (pinToVerify: string) => {
      if (!emergencyInfo?.id || !pinToVerify) return null;
      try {
        console.log(`Verifying PIN for emergency info ID ${emergencyInfo.id}`);
        const response = await apiRequest("POST", `/api/emergency-info/${emergencyInfo.id}/verify-pin`, { 
          pin: pinToVerify,
          careRecipientId: activeCareRecipientId  
        });
        const data = await response.json();
        console.log("PIN verification response:", data);
        return data;
      } catch (error) {
        console.error("Error during PIN verification:", error);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      if (data && data.verified) {
        console.log("PIN verification success response:", data);
        toast({
          title: "PIN Verified",
          description: "Emergency information unlocked",
          variant: "default",
        });
        setIsLocked(false);
        if (emergencyInfo?.id) {
          unlockPin(emergencyInfo.id);
          console.log(`Unlocking PIN ${emergencyInfo.id}`);
        }
        setShowPinDialog(false);
      } else if (data && data.needsCreation) {
        toast({
          title: "Not Found",
          description: data.message || "No emergency information exists. Please create it first.",
          variant: "destructive",
        });
        setShowPinDialog(false);
        setIsEditing(true);
      } else {
        console.error("Invalid PIN", data);
        setPinError("Invalid PIN");
      }
    },
    onError: (error) => {
      console.error("Error during PIN verification:", error);
      setPinError("Invalid PIN or server error");
    }
  });
  
  // Set PIN mutation
  const setPinMutation = useMutation({
    mutationFn: async (pinToSet: string) => {
      if (!emergencyInfo?.id || !pinToSet) return null;
      try {
        const response = await apiRequest("POST", `/api/emergency-info/${emergencyInfo.id}/set-pin`, { pin: pinToSet });
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error setting PIN:", error);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      if (data && data.success) {
        toast({
          title: "PIN Created",
          description: "Emergency information is now secured with your PIN",
          variant: "default",
        });
        setShowSetPinDialog(false);
        
        // We'll still need to verify the PIN now to unlock
        if (pin && emergencyInfo?.id) {
          verifyPinMutation.mutate(pin);
        }
        
        // Refresh the emergency info data to get the new pinHash
        queryClient.invalidateQueries({ queryKey: ["/api/emergency-info", activeCareRecipientId] });
      } else {
        toast({
          title: "Error",
          description: "Failed to create PIN",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("Error setting PIN:", error);
      setConfirmPinError("Failed to create PIN");
    }
  });

  const handleCreatePin = () => {
    // Validate the PIN
    if (pin.length < 4) {
      setConfirmPinError("PIN must be at least 4 characters");
      return;
    }
    
    if (pin !== confirmPin) {
      setConfirmPinError("PINs do not match");
      return;
    }
    
    setPinMutation.mutate(pin);
  };

  const handleVerifyPin = () => {
    if (!pin) {
      setPinError("PIN is required");
      return;
    }
    
    verifyPinMutation.mutate(pin);
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-50">
      <main className="flex-1 pb-16">
        <PageHeader 
          title="Emergency Information" 
          icon={<ShieldAlert className="h-6 w-6 text-red-500" />}
        />
        
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <Select value={activeCareRecipientId || ""} onValueChange={handleCareRecipientChange}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select care recipient" />
                </SelectTrigger>
                <SelectContent>
                  <Select.Group>
                    {careRecipientsQuery.data?.map((recipient) => (
                      <SelectItem key={recipient.id} value={recipient.id.toString()}>
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: recipient.color || "#9CA3AF" }}
                          ></div>
                          {recipient.name}
                        </div>
                      </SelectItem>
                    ))}
                  </Select.Group>
                </SelectContent>
              </Select>
            </div>

            {emergencyInfo && !isLocked && (
              <Button
                size="sm"
                variant={isEditing ? "default" : "outline"}
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? (
                  <>
                    <Trash2 className="h-4 w-4 mr-1 text-red-500" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </>
                )}
              </Button>
            )}
          </div>
          
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
                  onClick={() => setIsEditing(true)}
                >
                  <Plus className="h-4 w-4 mr-2" /> Create Emergency Information
                </Button>
              </CardContent>
            </Card>
          ) : isLocked ? (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Lock className="h-5 w-5 mr-2 text-gray-400" /> 
                  Secured Emergency Information
                </CardTitle>
                <CardDescription>
                  This information is PIN protected for privacy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Personal emergency information is secured for privacy reasons. 
                  Only caregivers with the correct PIN can access this data.
                </p>
                <Button variant="outline" size="sm" className="w-full" onClick={toggleLock}>
                  <Key className="h-4 w-4 mr-2" /> Unlock with PIN
                </Button>
              </CardContent>
            </Card>
          ) : isEditing ? (
            // Form for editing emergency information
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dateOfBirth">Date of Birth</Label>
                      <Input
                        id="dateOfBirth"
                        name="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div>
                      <Label htmlFor="socialSecurityNumber">Social Security Number</Label>
                      <Input
                        id="socialSecurityNumber"
                        name="socialSecurityNumber"
                        value={formData.socialSecurityNumber}
                        onChange={handleInputChange}
                        placeholder="XXX-XX-XXXX"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bloodType">Blood Type</Label>
                    <Select
                      value={formData.bloodType}
                      onValueChange={(value) => handleSelectChange("bloodType", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select blood type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Insurance Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="insuranceProvider">Insurance Provider</Label>
                    <Input
                      id="insuranceProvider"
                      name="insuranceProvider"
                      value={formData.insuranceProvider}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="insurancePolicyNumber">Policy Number</Label>
                      <Input
                        id="insurancePolicyNumber"
                        name="insurancePolicyNumber"
                        value={formData.insurancePolicyNumber}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div>
                      <Label htmlFor="insuranceGroupNumber">Group Number</Label>
                      <Input
                        id="insuranceGroupNumber"
                        name="insuranceGroupNumber"
                        value={formData.insuranceGroupNumber}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="insurancePhone">Insurance Phone</Label>
                    <Input
                      id="insurancePhone"
                      name="insurancePhone"
                      value={formData.insurancePhone}
                      onChange={handleInputChange}
                    />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Emergency Contacts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-md font-medium">Primary Contact</h3>
                    <div>
                      <Label htmlFor="emergencyContact1Name">Name</Label>
                      <Input
                        id="emergencyContact1Name"
                        name="emergencyContact1Name"
                        value={formData.emergencyContact1Name}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="emergencyContact1Phone">Phone</Label>
                        <Input
                          id="emergencyContact1Phone"
                          name="emergencyContact1Phone"
                          value={formData.emergencyContact1Phone}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div>
                        <Label htmlFor="emergencyContact1Relation">Relationship</Label>
                        <Input
                          id="emergencyContact1Relation"
                          name="emergencyContact1Relation"
                          value={formData.emergencyContact1Relation}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-md font-medium">Secondary Contact</h3>
                    <div>
                      <Label htmlFor="emergencyContact2Name">Name</Label>
                      <Input
                        id="emergencyContact2Name"
                        name="emergencyContact2Name"
                        value={formData.emergencyContact2Name}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="emergencyContact2Phone">Phone</Label>
                        <Input
                          id="emergencyContact2Phone"
                          name="emergencyContact2Phone"
                          value={formData.emergencyContact2Phone}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div>
                        <Label htmlFor="emergencyContact2Relation">Relationship</Label>
                        <Input
                          id="emergencyContact2Relation"
                          name="emergencyContact2Relation"
                          value={formData.emergencyContact2Relation}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Medical Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="allergies">Allergies</Label>
                    <Textarea
                      id="allergies"
                      name="allergies"
                      value={formData.allergies}
                      onChange={handleInputChange}
                      placeholder="List any allergies"
                    />
                  </div>
                  <div>
                    <Label htmlFor="medicationAllergies">Medication Allergies</Label>
                    <Textarea
                      id="medicationAllergies"
                      name="medicationAllergies"
                      value={formData.medicationAllergies}
                      onChange={handleInputChange}
                      placeholder="List any medication allergies"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="advanceDirectives"
                        checked={formData.advanceDirectives}
                        onCheckedChange={(checked) => handleSwitchChange("advanceDirectives", checked)}
                      />
                      <Label htmlFor="advanceDirectives">Advance Directives</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="dnrOrder"
                        checked={formData.dnrOrder}
                        onCheckedChange={(checked) => handleSwitchChange("dnrOrder", checked)}
                      />
                      <Label htmlFor="dnrOrder">DNR Order</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label htmlFor="additionalInfo">Additional Notes</Label>
                    <Textarea
                      id="additionalInfo"
                      name="additionalInfo"
                      value={formData.additionalInfo}
                      onChange={handleInputChange}
                      className="min-h-[100px]"
                      placeholder="Add any other important information"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <div className="w-full flex justify-end">
                    <Button onClick={handleSave} disabled={saveEmergencyInfoMutation.isPending}>
                      {saveEmergencyInfoMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </div>
          ) : (
            // Display emergency information
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <div className="flex justify-between py-1">
                    <span className="font-medium">Date of Birth:</span>
                    <span>
                      {emergencyInfo?.dateOfBirth ? 
                        new Date(emergencyInfo.dateOfBirth).toLocaleDateString() : 
                        "Not specified"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium">Social Security Number:</span>
                    <span>
                      {emergencyInfo?.socialSecurityNumber ? 
                        maskSSN(emergencyInfo.socialSecurityNumber) : 
                        "Not specified"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium">Blood Type:</span>
                    <span>{emergencyInfo?.bloodType || "Not specified"}</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Insurance Information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <div className="flex justify-between py-1">
                    <span className="font-medium">Insurance Provider:</span>
                    <span>{emergencyInfo?.insuranceProvider || "Not specified"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium">Policy Number:</span>
                    <span>{emergencyInfo?.insurancePolicyNumber || "Not specified"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium">Group Number:</span>
                    <span>{emergencyInfo?.insuranceGroupNumber || "Not specified"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium">Insurance Phone:</span>
                    <span>{emergencyInfo?.insurancePhone || "Not specified"}</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Emergency Contacts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    <div>
                      <h3 className="text-md font-medium mb-2">Primary Contact</h3>
                      <div className="grid gap-1">
                        <div className="flex justify-between py-1">
                          <span className="font-medium">Name:</span>
                          <span>{emergencyInfo?.emergencyContact1Name || "Not specified"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="font-medium">Phone:</span>
                          <span>{emergencyInfo?.emergencyContact1Phone || "Not specified"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="font-medium">Relationship:</span>
                          <span>{emergencyInfo?.emergencyContact1Relation || "Not specified"}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-md font-medium mb-2">Secondary Contact</h3>
                      <div className="grid gap-1">
                        <div className="flex justify-between py-1">
                          <span className="font-medium">Name:</span>
                          <span>{emergencyInfo?.emergencyContact2Name || "Not specified"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="font-medium">Phone:</span>
                          <span>{emergencyInfo?.emergencyContact2Phone || "Not specified"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="font-medium">Relationship:</span>
                          <span>{emergencyInfo?.emergencyContact2Relation || "Not specified"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Medical Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    <div>
                      <h3 className="text-md font-medium mb-2">Allergies</h3>
                      <p className="text-sm">
                        {emergencyInfo?.allergies || "None specified"}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-md font-medium mb-2">Medication Allergies</h3>
                      <p className="text-sm">
                        {emergencyInfo?.medicationAllergies || "None specified"}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium">Advance Directives:</span>
                        <span className="ml-2">{emergencyInfo?.advanceDirectives ? "Yes" : "No"}</span>
                      </div>
                      <div>
                        <span className="font-medium">DNR Order:</span>
                        <span className="ml-2">{emergencyInfo?.dnrOrder ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {emergencyInfo?.additionalInfo || "No additional information provided"}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="ml-auto" onClick={toggleLock}>
                    <Lock className="h-4 w-4 mr-2" /> Lock Information
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}
        </div>
      </main>
      
      <BottomNavigation activeTab={activeTab} onChangeTab={setActiveTab} />
      
      {/* PIN Verification Dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify PIN</DialogTitle>
            <DialogDescription>
              Enter your PIN to access emergency information
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                type="password"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                  setPinError("");
                }}
                className={pinError ? "border-red-500" : ""}
              />
              {pinError && <p className="text-sm text-red-500">{pinError}</p>}
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowPinDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleVerifyPin}
              disabled={verifyPinMutation.isPending}
            >
              {verifyPinMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Set PIN Dialog */}
      <Dialog open={showSetPinDialog} onOpenChange={setShowSetPinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create PIN</DialogTitle>
            <DialogDescription>
              Create a PIN to secure your emergency information
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="createPin">PIN</Label>
                <Input
                  id="createPin"
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="new-password"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                    setPinError("");
                  }}
                />
                <p className="text-xs text-gray-500">Enter a 4-6 digit PIN</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPin">Confirm PIN</Label>
                <Input
                  id="confirmPin"
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="new-password"
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                    setConfirmPinError("");
                  }}
                  className={confirmPinError ? "border-red-500" : ""}
                />
                {confirmPinError && (
                  <p className="text-sm text-red-500">{confirmPinError}</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowSetPinDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleCreatePin}
              disabled={setPinMutation.isPending}
            >
              {setPinMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Creating...
                </>
              ) : (
                "Create PIN"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}