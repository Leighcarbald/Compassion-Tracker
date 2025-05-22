import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TabType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill, Calendar, Building, Phone, Plus, Store } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import PageHeader from "@/components/PageHeader";
import type { Pharmacy } from "@shared/schema";
import { format } from "date-fns";
import { useCareRecipient } from "@/hooks/use-care-recipient";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/utils";
import { Pencil } from "lucide-react";

interface PharmaciesProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function Pharmacies({ activeTab, setActiveTab }: PharmaciesProps) {
  // Use global care recipient context
  const { activeCareRecipientId } = useCareRecipient();
  
  const [isAddPharmacyOpen, setIsAddPharmacyOpen] = useState(false);
  const [isEditPharmacyOpen, setIsEditPharmacyOpen] = useState(false);
  const [editingPharmacyId, setEditingPharmacyId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phoneNumber: "",
    notes: "",
  });
  
  const { toast } = useToast();
  
  // Fetch pharmacies
  const { data: pharmacies = [], isLoading: isLoadingPharmacies } = useQuery({
    queryKey: ["/api/pharmacies", activeCareRecipientId],
    enabled: !!activeCareRecipientId,
  });
  
  // Handle form input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Special handling for phone numbers
    if (name === "phoneNumber") {
      setFormData(prev => ({ ...prev, [name]: normalizePhoneNumber(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // Find a pharmacy by ID
  const findPharmacyById = (id: number) => {
    if (!pharmacies || !Array.isArray(pharmacies)) return null;
    // Ensure we handle both array and object structures
    return pharmacies.find((pharmacy: any) => pharmacy.id === id);
  };
  
  // Open edit pharmacy dialog
  const openEditPharmacyDialog = (pharmacyId: number) => {
    const pharmacy = findPharmacyById(pharmacyId);
    if (!pharmacy) return;
    
    setFormData({
      name: pharmacy.name,
      address: pharmacy.address || "",
      phoneNumber: pharmacy.phoneNumber,
      notes: pharmacy.notes || "",
    });
    
    setEditingPharmacyId(pharmacyId);
    setIsEditPharmacyOpen(true);
  };
  
  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      phoneNumber: "",
      notes: ""
    });
    setEditingPharmacyId(null);
  };
  
  // Handle add pharmacy
  const handleAddPharmacy = async () => {
    if (!activeCareRecipientId) return;
    
    try {
      await apiRequest(
        "POST", 
        "/api/pharmacies", 
        {
          ...formData,
          careRecipientId: Number(activeCareRecipientId)
        }
      );
      
      // Reset form and close dialog
      resetForm();
      setIsAddPharmacyOpen(false);
      
      // Invalidate pharmacies query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/pharmacies", activeCareRecipientId] });
      
      toast({
        title: "Pharmacy added successfully",
        description: `${formData.name} has been added to your pharmacy list.`,
        variant: "default",
      });
    } catch (error) {
      console.error("Error adding pharmacy:", error);
      toast({
        title: "Failed to add pharmacy",
        description: "There was an error adding the pharmacy. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Handle edit pharmacy
  const handleEditPharmacy = async () => {
    if (!editingPharmacyId) return;
    
    try {
      await apiRequest(
        "PATCH", 
        `/api/pharmacies/${editingPharmacyId}`, 
        formData
      );
      
      // Reset form and close dialog
      resetForm();
      setIsEditPharmacyOpen(false);
      
      // Invalidate pharmacies query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/pharmacies", activeCareRecipientId] });
      
      toast({
        title: "Pharmacy updated successfully",
        description: `${formData.name} has been updated.`,
        variant: "default",
      });
    } catch (error) {
      console.error("Error updating pharmacy:", error);
      toast({
        title: "Failed to update pharmacy",
        description: "There was an error updating the pharmacy. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <PageHeader title="Pharmacies" icon={<Store className="h-6 w-6" />} />
      
      {/* Care Recipient Tabs are no longer needed since we're using global context */}
      
      {/* Add Pharmacy Button */}
      {activeCareRecipientId && (
        <div className="flex justify-end mb-4">
          <Dialog open={isAddPharmacyOpen} onOpenChange={setIsAddPharmacyOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Pharmacy
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Pharmacy</DialogTitle>
                <DialogDescription>
                  Enter the pharmacy's details below. All fields marked with * are required.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name *
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="address" className="text-right">
                    Address *
                  </Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phoneNumber" className="text-right">
                    Phone Number *
                  </Label>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="notes" className="text-right">
                    Notes
                  </Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleAddPharmacy} disabled={!formData.name || !formData.address || !formData.phoneNumber}>
                  Add Pharmacy
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      
      {/* Pharmacies List */}
      {isLoadingPharmacies ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : !activeCareRecipientId ? (
        <div className="text-center p-8 text-gray-500">
          Please select a care recipient to view their pharmacies
        </div>
      ) : pharmacies.length === 0 ? (
        <div className="text-center p-8 text-gray-500">
          No pharmacies found. Add a pharmacy to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {pharmacies.map((pharmacy: Pharmacy) => (
            <Card key={pharmacy.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    {pharmacy.name}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      openEditPharmacyDialog(pharmacy.id);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {pharmacy.address}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <span>{formatPhoneNumber(pharmacy.phoneNumber)}</span>
                  </div>
                  {pharmacy.notes && (
                    <div className="mt-2 text-sm border-t pt-2">
                      <span className="font-medium">Notes:</span> {pharmacy.notes}
                    </div>
                  )}
                  
                  {pharmacy.medicationRelations && pharmacy.medicationRelations.length > 0 && (
                    <div className="mt-4 border-t pt-2">
                      <span className="font-medium text-sm">Medications:</span>
                      <ul className="list-disc list-inside text-sm mt-1">
                        {pharmacy.medicationRelations.map(relation => {
                          const medication = relation.medication;
                          return (
                            <li key={relation.id} className="mb-2">
                              <div className="flex items-center gap-1">
                                <Pill className="h-3 w-3 text-primary" />
                                <span className="font-medium">{medication.name}</span> - {medication.dosage}
                              </div>
                              {relation.refillInfo && (
                                <div className="text-xs ml-5">
                                  Refill info: {relation.refillInfo}
                                </div>
                              )}
                              {relation.lastRefillDate && (
                                <div className="text-xs ml-5 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Last refill: {format(new Date(relation.lastRefillDate), 'MMM d, yyyy')}
                                </div>
                              )}
                              {relation.nextRefillDate && (
                                <div className="text-xs ml-5 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Next refill: {format(new Date(relation.nextRefillDate), 'MMM d, yyyy')}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Edit Pharmacy Dialog */}
      <Dialog open={isEditPharmacyOpen} onOpenChange={setIsEditPharmacyOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Pharmacy</DialogTitle>
            <DialogDescription>
              Make changes to the pharmacy details below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name *
              </Label>
              <Input
                id="edit-name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-address" className="text-right">
                Address *
              </Label>
              <Input
                id="edit-address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-phoneNumber" className="text-right">
                Phone Number *
              </Label>
              <Input
                id="edit-phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-notes" className="text-right">
                Notes
              </Label>
              <Textarea
                id="edit-notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                resetForm();
                setIsEditPharmacyOpen(false);
              }}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              onClick={handleEditPharmacy} 
              disabled={!formData.name || !formData.address || !formData.phoneNumber}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <BottomNavigation 
        activeTab={activeTab} 
        onChangeTab={setActiveTab} 
      />
    </div>
  );
}