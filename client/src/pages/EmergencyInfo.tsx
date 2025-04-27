import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/Header";
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
  const { activeCareRecipientId, setActiveCareRecipientId, careRecipients, isLoading: isLoadingCareRecipients } = useCareRecipient();
  
  // Debug effect - run whenever the component mounts or re-renders
  useEffect(() => {
    console.log('🔍 EmergencyInfo component mounted/rendered');
    
    // Component cleanup
    return () => {
      console.log('🔍 EmergencyInfo component unmounting');
    };
  }, []);

  // Fetch emergency info for selected care recipient
  const { data: emergencyInfo, isLoading, error: emergencyInfoError } = useQuery<EmergencyInfoType>({
    queryKey: ["/api/emergency-info", activeCareRecipientId],
    enabled: !!activeCareRecipientId
  });

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
      
      // When isLocked is already false, we don't need to check verification status
      // This helps prevent constant re-verification loops
      if (!isLocked) {
        console.log(`Emergency info is already unlocked, skipping verification check`);
        return;
      }
      
      // First check local PIN storage - this is using our enhanced security
      // with automatic expiration after 15 minutes
      const pinUnlockedLocally = emergencyInfo.id ? isUnlocked(emergencyInfo.id) : false;
      console.log(`PIN ${emergencyInfo.id} IS UNLOCKED LOCALLY: ${pinUnlockedLocally}`);
      
      if (pinUnlockedLocally) {
        console.log(`PIN ${emergencyInfo.id} is verified in local storage with security expiration, unlocking...`);
        setIsLocked(false);
        console.log(`VERIFICATION: PIN ${emergencyInfo.id} is now unlocked: ${!isLocked}`);
        return;
      } 
      
      // If we're here, the PIN isn't verified locally
      // We'll check with the server once when the emergency info first loads
      // but only when the component initially mounts (using initialLoadRef)
      if (initialLoadRef.current && emergencyInfo.id) {
        initialLoadRef.current = false;
        
        console.log(`Initial load check: checking server verification status for PIN ${emergencyInfo.id}...`);
        fetch(`/api/emergency-info/${emergencyInfo.id}/check-verified`)
          .then(response => response.json())
          .then(data => {
            console.log(`Server verification check for PIN ${emergencyInfo.id}:`, data);
            if (data.verified) {
              console.log('Emergency info is verified in server session, unlocking...');
              setIsLocked(false);
              // Also update local state to reflect this
              unlockPin(emergencyInfo.id);
            } else {
              console.log('Emergency info not verified in current session, staying locked');
              // We don't need to explicitly set isLocked to true here
              // as it's already true (default state)
            }
          })
          .catch(error => {
            console.error('Error checking PIN verification status:', error);
            // Keep locked on error for security (already locked by default)
          });
      }
    }
  }, [emergencyInfo, isLocked, isUnlocked]);

  // Handle care recipient selection
  const handleCareRecipientChange = (id: string) => {
    setActiveCareRecipientId(id);
    // Reset editing state when changing care recipient
    setIsEditing(false);
    
    // Reset to locked state initially - the useEffect will check
    // localStorage after emergencyInfo loads and unlock if previously authenticated
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
      // Don't lock the information after saving - this would be frustrating for users
      // who want to continue viewing the information after saving
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
        // Handle the case where emergency info isn't loaded yet
        // We'll create it automatically later, but for now, show appropriate message
        toast({
          title: "Emergency Information",
          description: "Loading emergency information or creating a new record. Please try again in a moment.",
          duration: 3000,
        });
        // Try to trigger creation by refreshing the query
        if (activeCareRecipientId) {
          queryClient.invalidateQueries({ queryKey: ["/api/emergency-info", activeCareRecipientId] });
        }
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
      
      // First check if the server already has this PIN verified (via cookies)
      console.log(`Checking if PIN ${emergencyInfo.id} is already verified on server before showing dialog...`);
      fetch(`/api/emergency-info/${emergencyInfo.id}/check-verified`)
        .then(response => response.json())
        .then(data => {
          if (data.verified) {
            // PIN is already verified via server cookie, unlock without prompting
            console.log('Server already has this PIN verified, unlocking without prompting');
            setIsLocked(false);
            unlockPin(emergencyInfo.id);
            toast({
              title: "Authenticated",
              description: "Emergency information unlocked via existing session",
              duration: 2000,
            });
          } else {
            // Not verified on server, show dialog for manual entry
            console.log('PIN not verified in server session, showing verification dialog');
            setShowPinDialog(true);
            setPin("");
            setPinError("");
          }
        })
        .catch(error => {
          console.error('Error checking PIN verification status:', error);
          // Show verification dialog on error
          setShowPinDialog(true);
          setPin("");
          setPinError("");
        });
    } else {
      // Lock the information (this is immediate)
      setIsLocked(true);
      setPin("");
      setPinError("");
      
      // Clear the authenticated state on both client and server
      if (emergencyInfo?.id) {
        // Clear client-side PIN
        lockPin(emergencyInfo.id);
        console.log(`Locked PIN access for emergency info #${emergencyInfo.id} (client-side)`);
        
        // Clear server-side cookie by calling the lock endpoint
        fetch(`/api/emergency-info/${emergencyInfo.id}/lock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        .then(response => response.json())
        .then(data => {
          console.log('Server-side lock response:', data);
          if (data.success) {
            console.log(`Successfully cleared server-side PIN verification cookie for ID ${emergencyInfo.id}`);
          } else {
            console.error(`Failed to clear server PIN verification: ${data.message}`);
          }
        })
        .catch(error => {
          console.error('Error clearing server PIN verification:', error);
        });
        
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
        const response = await apiRequest("POST", `/api/emergency-info/${emergencyInfo.id}/verify-pin`, { pin: pinToVerify });
        const data = await response.json();
        console.log("PIN verification response:", data);
        return data;
      } catch (error) {
        console.error("Error during PIN verification:", error);
        throw error;
      }
    },
    onSuccess: (data: { message: string; verified: boolean } | null) => {
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
    onSuccess: (data: { message: string; success: boolean } | null) => {
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
      toast({
        title: "Error",
        description: "Failed to create PIN",
        variant: "destructive",
      });
    }
  });
  
  const validatePin = () => {
    if (pin.length !== 6) {
      setPinError("PIN must be 6 digits");
      return false;
    }
    return true;
  };
  
  const validateSetPin = () => {
    if (pin.length !== 6) {
      setPinError("PIN must be 6 digits");
      return false;
    }
    
    if (pin !== confirmPin) {
      setConfirmPinError("PINs do not match");
      return false;
    }
    
    return true;
  };
  
  const handleSetPin = () => {
    if (validateSetPin()) {
      setPinMutation.mutate(pin);
    }
  };
  
  const handlePinSubmit = () => {
    if (pin.length !== 6) {
      setPinError('PIN must be 6 digits');
      return;
    }
    
    if (!emergencyInfo?.id) return;
    
    verifyPinMutation.mutate(pin);
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-50">
      <Header />

      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <PageHeader 
          title="Emergency Information" 
          icon={<ShieldAlert className="h-6 w-6 text-red-500" />}
          showHomeButton={false} 
        />
        
        <div className="flex justify-end gap-2 mt-2 mb-4">
            <Button 
              size="sm" 
              variant={isLocked ? "outline" : "destructive"} 
              onClick={toggleLock}
            >
              {isLocked ? <Lock className="h-4 w-4 mr-1" /> : <Unlock className="h-4 w-4 mr-1" />}
              {isLocked ? "Unlock" : "Lock"}
            </Button>
            {!isLocked && (
              <Button 
                size="sm" 
                variant={isEditing ? "destructive" : "outline"} 
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "Cancel" : <Edit className="h-4 w-4 mr-1" />}
                {isEditing ? "Cancel" : "Edit"}
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
        ) : (
          <>
            {isLocked ? (
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
            ) : (
              <>
                {/* Personal Info Section */}
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent className={!isEditing ? "grid gap-2" : ""}>
                    {isEditing ? (
                      <div className="grid gap-4">
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
                            <Label htmlFor="bloodType">Blood Type</Label>
                            <Select 
                              value={formData.bloodType} 
                              onValueChange={(value) => handleSelectChange("bloodType", value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
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
                        </div>
                        <div>
                          <Label htmlFor="ssn">Social Security Number</Label>
                          <Input 
                            id="ssn" 
                            name="socialSecurityNumber" 
                            value={formData.socialSecurityNumber} 
                            onChange={handleInputChange}
                            placeholder="XXX-XX-XXXX"
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
                      </div>
                    ) : (
                      <>
                        {formData.dateOfBirth && (
                          <div className="flex justify-between py-1 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-500">Date of Birth</span>
                            <span className="text-sm">{formData.dateOfBirth}</span>
                          </div>
                        )}
                        
                        {formData.socialSecurityNumber && (
                          <div className="flex justify-between py-1 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-500">SSN</span>
                            <span className="text-sm">
                              {formData.socialSecurityNumber}
                            </span>
                          </div>
                        )}
                        
                        {formData.bloodType && (
                          <div className="flex justify-between py-1 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-500">Blood Type</span>
                            <span className="text-sm">{formData.bloodType}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-500">Advance Directives</span>
                          <span className="text-sm">{formData.advanceDirectives ? "Yes" : "No"}</span>
                        </div>
                        
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-500">DNR Order</span>
                          <span className="text-sm">{formData.dnrOrder ? "Yes" : "No"}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
                
                {/* Insurance Section */}
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Insurance Information</CardTitle>
                  </CardHeader>
                  <CardContent className={!isEditing ? "grid gap-2" : ""}>
                    {isEditing ? (
                      <div className="grid gap-4">
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
                            placeholder="XXX-XXX-XXXX"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        {formData.insuranceProvider && (
                          <div className="flex justify-between py-1 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-500">Provider</span>
                            <span className="text-sm">{formData.insuranceProvider}</span>
                          </div>
                        )}
                        
                        {formData.insurancePolicyNumber && (
                          <div className="flex justify-between py-1 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-500">Policy #</span>
                            <span className="text-sm">{formData.insurancePolicyNumber}</span>
                          </div>
                        )}
                        
                        {formData.insuranceGroupNumber && (
                          <div className="flex justify-between py-1 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-500">Group #</span>
                            <span className="text-sm">{formData.insuranceGroupNumber}</span>
                          </div>
                        )}
                        
                        {formData.insurancePhone && (
                          <div className="flex justify-between py-1 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-500">Phone</span>
                            <span className="text-sm">{formData.insurancePhone}</span>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
                
                {/* Emergency Contacts Section */}
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Emergency Contacts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <div className="grid gap-6">
                        <div>
                          <h3 className="text-sm font-medium mb-2">Primary Contact</h3>
                          <div className="grid gap-4">
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
                                  placeholder="XXX-XXX-XXXX"
                                />
                              </div>
                              <div>
                                <Label htmlFor="emergencyContact1Relation">Relation</Label>
                                <Input 
                                  id="emergencyContact1Relation" 
                                  name="emergencyContact1Relation" 
                                  value={formData.emergencyContact1Relation} 
                                  onChange={handleInputChange}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium mb-2">Secondary Contact</h3>
                          <div className="grid gap-4">
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
                                  placeholder="XXX-XXX-XXXX"
                                />
                              </div>
                              <div>
                                <Label htmlFor="emergencyContact2Relation">Relation</Label>
                                <Input 
                                  id="emergencyContact2Relation" 
                                  name="emergencyContact2Relation" 
                                  value={formData.emergencyContact2Relation} 
                                  onChange={handleInputChange}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* First Contact */}
                        {formData.emergencyContact1Name && (
                          <div className="mb-4">
                            <h3 className="text-sm font-medium border-b border-gray-100 pb-1 mb-1">Primary Contact</h3>
                            <div className="pl-2">
                              <div className="py-1">
                                <span className="block text-sm">{formData.emergencyContact1Name}</span>
                                {formData.emergencyContact1Relation && (
                                  <span className="text-xs text-gray-500">({formData.emergencyContact1Relation})</span>
                                )}
                              </div>
                              {formData.emergencyContact1Phone && (
                                <div className="py-1 text-sm">{formData.emergencyContact1Phone}</div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Second Contact */}
                        {formData.emergencyContact2Name && (
                          <div>
                            <h3 className="text-sm font-medium border-b border-gray-100 pb-1 mb-1">Secondary Contact</h3>
                            <div className="pl-2">
                              <div className="py-1">
                                <span className="block text-sm">{formData.emergencyContact2Name}</span>
                                {formData.emergencyContact2Relation && (
                                  <span className="text-xs text-gray-500">({formData.emergencyContact2Relation})</span>
                                )}
                              </div>
                              {formData.emergencyContact2Phone && (
                                <div className="py-1 text-sm">{formData.emergencyContact2Phone}</div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {!formData.emergencyContact1Name && !formData.emergencyContact2Name && (
                          <div className="text-gray-500 text-sm py-2">No emergency contacts added</div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
                
                {/* Allergies Section */}
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Allergies & Additional Info</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <div className="grid gap-4">
                        <div>
                          <Label htmlFor="allergies">Allergies</Label>
                          <Textarea 
                            id="allergies" 
                            name="allergies" 
                            value={formData.allergies} 
                            onChange={handleInputChange}
                            placeholder="Food, environmental, or other allergies"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="medicationAllergies">Medication Allergies</Label>
                          <Textarea 
                            id="medicationAllergies" 
                            name="medicationAllergies" 
                            value={formData.medicationAllergies} 
                            onChange={handleInputChange}
                            placeholder="List all drug allergies"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="additionalInfo">Additional Information</Label>
                          <Textarea 
                            id="additionalInfo" 
                            name="additionalInfo" 
                            value={formData.additionalInfo} 
                            onChange={handleInputChange}
                            placeholder="Other important medical history or notes"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-3">
                          <h3 className="text-sm font-medium mb-1">Allergies</h3>
                          <div className="p-2 bg-gray-50 rounded text-sm min-h-[40px]">
                            {formData.allergies || "None listed"}
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <h3 className="text-sm font-medium mb-1">Medication Allergies</h3>
                          <div className="p-2 bg-gray-50 rounded text-sm min-h-[40px]">
                            {formData.medicationAllergies || "None listed"}
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium mb-1">Additional Information</h3>
                          <div className="p-2 bg-gray-50 rounded text-sm min-h-[40px]">
                            {formData.additionalInfo || "No additional information"}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
                
                {isEditing && (
                  <div className="flex justify-end gap-2 mt-6 mb-10">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saveEmergencyInfoMutation.isPending}>
                      {saveEmergencyInfoMutation.isPending ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
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
                )}
              </>
            )}
          </>
        )}
      </main>
      
      <BottomNavigation activeTab={activeTab} onChangeTab={setActiveTab} />
      
      {/* Add Event Modal */}
      <AddCareEventModal
        isOpen={isAddEventModalOpen}
        onClose={() => setIsAddEventModalOpen(false)}
        careRecipientId={activeCareRecipientId}
      />
      
      {/* PIN Verification Dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter PIN</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pin" className="text-left">
                PIN (6 digits)
              </Label>
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
              variant="default"
              onClick={handlePinSubmit}
              disabled={verifyPinMutation.isPending}
            >
              {verifyPinMutation.isPending ? "Verifying..." : "Verify PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Set PIN Dialog */}
      <Dialog open={showSetPinDialog} onOpenChange={setShowSetPinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Security PIN</DialogTitle>
            <DialogDescription>
              This PIN will protect sensitive emergency information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-pin" className="text-left">
                Create PIN (6 digits)
              </Label>
              <Input
                id="new-pin"
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
                className={pinError ? "border-red-500" : ""}
              />
              {pinError && <p className="text-sm text-red-500">{pinError}</p>}
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="confirm-pin" className="text-left">
                Confirm PIN
              </Label>
              <Input
                id="confirm-pin"
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
              {confirmPinError && <p className="text-sm text-red-500">{confirmPinError}</p>}
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => setShowSetPinDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSetPin}
              disabled={setPinMutation.isPending}
            >
              {setPinMutation.isPending ? "Creating..." : "Create PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}