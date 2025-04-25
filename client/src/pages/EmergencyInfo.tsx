import { useState, useEffect } from "react";
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
import { EmergencyInfo as EmergencyInfoType, CareRecipient } from "@shared/schema";

interface EmergencyInfoProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function EmergencyInfo({ activeTab, setActiveTab }: EmergencyInfoProps) {
  const [selectedCareRecipient, setSelectedCareRecipient] = useState<string | null>(null);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // Start with locked state, but we'll check for authentication in useEffect
  const [isLocked, setIsLocked] = useState(true);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const { toast } = useToast();

  // Fetch care recipients
  const { data: careRecipients = [] } = useQuery<CareRecipient[]>({
    queryKey: ["/api/care-recipients"],
  });

  // Fetch emergency info for selected care recipient
  const { data: emergencyInfo, isLoading } = useQuery<EmergencyInfoType>({
    queryKey: ["/api/emergency-info", selectedCareRecipient],
    enabled: !!selectedCareRecipient,
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
      
      // Check if we have previously authenticated this emergency info
      const wasAuthenticated = localStorage.getItem(`emergency_info_authenticated_${emergencyInfo.id}`);
      if (wasAuthenticated === 'true') {
        setIsLocked(false);
      }
    }
  }, [emergencyInfo]);

  // Handle care recipient selection
  const handleCareRecipientChange = (id: string) => {
    setSelectedCareRecipient(id);
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
      if (!selectedCareRecipient) return;
      
      const careRecipientId = parseInt(selectedCareRecipient);
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
      queryClient.invalidateQueries({ queryKey: ["/api/emergency-info", selectedCareRecipient] });
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
      // Show PIN dialog to unlock
      setShowPinDialog(true);
    } else {
      // Lock the information
      setIsLocked(true);
      setPin("");
      setPinError("");
      
      // Clear the authenticated state when locking
      if (emergencyInfo?.id) {
        localStorage.removeItem(`emergency_info_authenticated_${emergencyInfo.id}`);
      }
    }
  };
  
  // Verify PIN mutation
  const verifyPinMutation = useMutation({
    mutationFn: async (pinToVerify: string) => {
      if (!emergencyInfo?.id || !pinToVerify) return null;
      const response = await apiRequest("POST", `/api/emergency-info/${emergencyInfo.id}/verify-pin`, { pin: pinToVerify });
      return response.json();
    },
    onSuccess: (data: { message: string; verified: boolean } | null) => {
      if (data?.verified) {
        setIsLocked(false);
        setShowPinDialog(false);
        setPin("");
        setPinError("");
        
        // Store that we've successfully authenticated with the PIN
        // This will help solve the issue where it keeps asking for a new PIN
        localStorage.setItem(`emergency_info_authenticated_${emergencyInfo?.id}`, 'true');
      } else {
        setPinError("Incorrect PIN. Please try again.");
      }
    },
    onError: (error) => {
      setPinError("Failed to verify PIN. Please try again.");
      console.error("PIN verification error:", error);
    }
  });
  
  // Set PIN mutation
  const setPinMutation = useMutation({
    mutationFn: async (newPin: string) => {
      if (!emergencyInfo?.id) return null;
      const response = await apiRequest("POST", `/api/emergency-info/${emergencyInfo.id}/set-pin`, { pin: newPin });
      return response.json();
    },
    onSuccess: (data: { message: string; success: boolean } | null) => {
      if (data?.success) {
        toast({
          title: "PIN Updated",
          description: "Emergency information PIN has been updated successfully",
          variant: "default",
        });
        
        // Store that we've successfully set a PIN and are authenticated
        localStorage.setItem(`emergency_info_authenticated_${emergencyInfo?.id}`, 'true');
        
        // Refresh emergency info data to get updated pinHash status
        queryClient.invalidateQueries({ queryKey: ["/api/emergency-info", selectedCareRecipient] });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update PIN",
        variant: "destructive",
      });
      console.error("PIN update error:", error);
    }
  });
  
  const handlePinSubmit = () => {
    if (pin.length !== 4) {
      setPinError('PIN must be 4 digits');
      return;
    }
    
    if (!emergencyInfo?.id) return;
    
    verifyPinMutation.mutate(pin);
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-50">
      <Header
        activeCareRecipient={selectedCareRecipient}
        careRecipients={careRecipients}
        onChangeRecipient={handleCareRecipientChange}
        isLoading={false}
      />

      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold flex items-center">
            <ShieldAlert className="mr-2 text-red-500" />
            Emergency Information
          </h1>
          <div className="flex gap-2">
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
                variant="outline" 
                onClick={() => setIsEditing(!isEditing)}
                disabled={!selectedCareRecipient}
              >
                <Edit className="h-4 w-4 mr-1" />
                {isEditing ? "Cancel" : "Edit"}
              </Button>
            )}
            {isEditing && (
              <Button 
                size="sm" 
                onClick={handleSave}
                disabled={saveEmergencyInfoMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            )}
          </div>
        </div>

        {!selectedCareRecipient ? (
          <div className="text-center p-8">
            <p className="text-gray-500">Please select a care recipient to view or edit emergency information.</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : isLocked ? (
          <div className="bg-white p-6 rounded-lg shadow-md text-center space-y-4 mt-4">
            <Lock className="h-12 w-12 mx-auto text-gray-400" />
            <h2 className="text-xl font-medium">Sensitive Information Protected</h2>
            <p className="text-gray-500">
              This section contains sensitive personal and medical information.
              Click the "Unlock" button to view and edit this information.
            </p>
            <p className="text-sm text-gray-400">
              Please ensure privacy when viewing sensitive information.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Personal Information Section */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Basic personal details and identifiers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="socialSecurityNumber">Social Security Number</Label>
                    <Input
                      id="socialSecurityNumber"
                      name="socialSecurityNumber"
                      value={formData.socialSecurityNumber}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      placeholder="XXX-XX-XXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bloodType">Blood Type</Label>
                    <Select 
                      disabled={!isEditing}
                      value={formData.bloodType}
                      onValueChange={(value) => handleSelectChange("bloodType", value)}
                    >
                      <SelectTrigger id="bloodType">
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
                </div>
              </CardContent>
            </Card>

            {/* Insurance Information Section */}
            <Card>
              <CardHeader>
                <CardTitle>Insurance Information</CardTitle>
                <CardDescription>Health insurance details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="insuranceProvider">Insurance Provider</Label>
                  <Input
                    id="insuranceProvider"
                    name="insuranceProvider"
                    value={formData.insuranceProvider}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="insurancePolicyNumber">Policy Number</Label>
                    <Input
                      id="insurancePolicyNumber"
                      name="insurancePolicyNumber"
                      value={formData.insurancePolicyNumber}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="insuranceGroupNumber">Group Number</Label>
                    <Input
                      id="insuranceGroupNumber"
                      name="insuranceGroupNumber"
                      value={formData.insuranceGroupNumber}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insurancePhone">Insurance Phone</Label>
                  <Input
                    id="insurancePhone"
                    name="insurancePhone"
                    value={formData.insurancePhone}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="(XXX) XXX-XXXX"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contacts Section */}
            <Card>
              <CardHeader>
                <CardTitle>Emergency Contacts</CardTitle>
                <CardDescription>People to contact in case of emergency</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="font-medium">Primary Contact</div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContact1Name">Name</Label>
                    <Input
                      id="emergencyContact1Name"
                      name="emergencyContact1Name"
                      value={formData.emergencyContact1Name}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContact1Phone">Phone</Label>
                      <Input
                        id="emergencyContact1Phone"
                        name="emergencyContact1Phone"
                        value={formData.emergencyContact1Phone}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        placeholder="(XXX) XXX-XXXX"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContact1Relation">Relationship</Label>
                      <Input
                        id="emergencyContact1Relation"
                        name="emergencyContact1Relation"
                        value={formData.emergencyContact1Relation}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200 space-y-4">
                  <div className="font-medium">Secondary Contact</div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContact2Name">Name</Label>
                    <Input
                      id="emergencyContact2Name"
                      name="emergencyContact2Name"
                      value={formData.emergencyContact2Name}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContact2Phone">Phone</Label>
                      <Input
                        id="emergencyContact2Phone"
                        name="emergencyContact2Phone"
                        value={formData.emergencyContact2Phone}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        placeholder="(XXX) XXX-XXXX"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContact2Relation">Relationship</Label>
                      <Input
                        id="emergencyContact2Relation"
                        name="emergencyContact2Relation"
                        value={formData.emergencyContact2Relation}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Allergies Section */}
            <Card>
              <CardHeader>
                <CardTitle>Allergies</CardTitle>
                <CardDescription>Important allergy information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="allergies">General Allergies</Label>
                  <Textarea
                    id="allergies"
                    name="allergies"
                    value={formData.allergies}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="Food, environmental, or other allergies"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medicationAllergies">Medication Allergies</Label>
                  <Textarea
                    id="medicationAllergies"
                    name="medicationAllergies"
                    value={formData.medicationAllergies}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="List all medication allergies"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Medical Directives Section */}
            <Card>
              <CardHeader>
                <CardTitle>Medical Directives</CardTitle>
                <CardDescription>Advanced medical decisions and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="advanceDirectives">Advance Directives</Label>
                    <p className="text-sm text-gray-500">Has advance directives on file</p>
                  </div>
                  <Switch
                    id="advanceDirectives"
                    checked={formData.advanceDirectives}
                    onCheckedChange={(checked) => handleSwitchChange("advanceDirectives", checked)}
                    disabled={!isEditing}
                  />
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <div className="space-y-0.5">
                    <Label htmlFor="dnrOrder" className="text-red-600 font-medium">DNR Order</Label>
                    <p className="text-sm text-gray-500">Do Not Resuscitate order on file</p>
                  </div>
                  <Switch
                    id="dnrOrder"
                    checked={formData.dnrOrder}
                    onCheckedChange={(checked) => handleSwitchChange("dnrOrder", checked)}
                    disabled={!isEditing}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Additional Information Section */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
                <CardDescription>Any other important emergency information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Textarea
                    id="additionalInfo"
                    name="additionalInfo"
                    value={formData.additionalInfo}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="Enter any additional information that may be important in an emergency"
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <BottomNavigation
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onAddEvent={() => setIsAddEventModalOpen(true)}
      />

      {isAddEventModalOpen && (
        <AddCareEventModal
          isOpen={isAddEventModalOpen}
          onClose={() => setIsAddEventModalOpen(false)}
          careRecipientId={selectedCareRecipient}
        />
      )}

      {/* PIN Dialog */}
      <Dialog open={showPinDialog} onOpenChange={(open) => !open && setShowPinDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Security PIN</DialogTitle>
            <DialogDescription>
              Please enter your 4-digit PIN to unlock sensitive information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="pin">PIN Code</Label>
              <Input
                id="pin"
                type="password"
                placeholder="Enter 4-digit PIN"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  // Only allow numeric input
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setPin(value);
                  if (pinError) setPinError('');
                }}
              />
              {pinError && <p className="text-sm text-red-500">{pinError}</p>}
              {!emergencyInfo?.pinHash && (
                <p className="text-xs text-gray-500 mt-2">
                  No PIN set yet. Please create a new 4-digit PIN to secure this information.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowPinDialog(false)}>
              Cancel
            </Button>
            {emergencyInfo?.pinHash ? (
              // If PIN already exists, show unlock button
              <Button 
                type="button" 
                onClick={handlePinSubmit} 
                disabled={pin.length !== 4 || verifyPinMutation.isPending}
              >
                {verifyPinMutation.isPending ? 'Verifying...' : 'Unlock'}
              </Button>
            ) : (
              // If no PIN exists yet, show set PIN button
              <Button 
                type="button" 
                onClick={() => {
                  // Set new PIN
                  if (pin.length === 4) {
                    setPinMutation.mutate(pin);
                    setShowPinDialog(false);
                    setIsLocked(false);
                    
                    // Set the authenticated state immediately
                    if (emergencyInfo?.id) {
                      localStorage.setItem(`emergency_info_authenticated_${emergencyInfo.id}`, 'true');
                    }
                  }
                }} 
                disabled={pin.length !== 4 || setPinMutation.isPending}
              >
                {setPinMutation.isPending ? 'Creating...' : 'Create PIN'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Set/Change PIN dialog */}
      <Dialog>
        <DialogTrigger asChild>
          {!isLocked && (
            <Button
              size="sm"
              variant="outline"
              className="ml-2"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Key className="h-4 w-4 mr-1" />
              Change PIN
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set New Security PIN</DialogTitle>
            <DialogDescription>
              Create a new 4-digit PIN to protect sensitive emergency information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="newPin">New PIN Code</Label>
              <Input
                id="newPin"
                type="password"
                placeholder="Enter 4-digit PIN"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  // Only allow numeric input
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setPin(value);
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPin("")}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => {
                if (pin.length === 4) {
                  setPinMutation.mutate(pin);
                  setPin("");
                }
              }} 
              disabled={pin.length !== 4 || setPinMutation.isPending}
            >
              {setPinMutation.isPending ? 'Saving...' : 'Save PIN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}