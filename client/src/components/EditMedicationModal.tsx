import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Medication, MedicationSchedule } from '@shared/schema';

interface EditMedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  medication: Medication | null;
}

export default function EditMedicationModal({
  isOpen,
  onClose,
  medication,
}: EditMedicationModalProps) {
  const [medicationData, setMedicationData] = useState<any>({
    name: '',
    dosage: '',
    instructions: '',
    form: 'pill',
    icon: 'pill',
    iconColor: 'blue',
    prescribingDoctorId: null,
    prescriptionNumber: '',
    reorderThreshold: 5,
  });

  const { toast } = useToast();

  useEffect(() => {
    if (medication) {
      setMedicationData({
        id: medication.id,
        name: medication.name || '',
        dosage: medication.dosage || '',
        instructions: medication.instructions || '',
        form: medication.form || 'pill',
        icon: medication.icon || 'pill',
        iconColor: medication.iconColor || 'blue',
        prescribingDoctorId: medication.prescribingDoctorId || null,
        prescriptionNumber: medication.prescriptionNumber || '',
        reorderThreshold: medication.reorderThreshold || 5,
        careRecipientId: medication.careRecipientId,
      });
    }
  }, [medication]);

  const updateMedicationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest(
        "PATCH",
        `/api/medications/${data.id}`,
        data
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Medication Updated",
        description: "Successfully updated the medication information"
      });
      
      // Refresh medication data
      queryClient.invalidateQueries({ queryKey: ['/api/medications'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update medication: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setMedicationData((prev: any) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setMedicationData((prev: any) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const parsedValue = parseInt(value);
    
    if (!isNaN(parsedValue) || value === '') {
      setMedicationData((prev: any) => ({
        ...prev,
        [name]: value === '' ? '' : parsedValue
      }));
    }
  };

  const handleSave = () => {
    if (!medicationData.name || !medicationData.dosage) {
      toast({
        title: "Missing Information",
        description: "Please provide both name and dosage for the medication",
        variant: "destructive"
      });
      return;
    }
    
    updateMedicationMutation.mutate(medicationData);
  };

  // Form based medicine options
  const getMedicationFormOptions = () => {
    return [
      { value: 'pill', label: 'Pill' },
      { value: 'tablet', label: 'Tablet' },
      { value: 'capsule', label: 'Capsule' },
      { value: 'liquid', label: 'Liquid' },
      { value: 'injection', label: 'Injection' },
      { value: 'patch', label: 'Patch' },
      { value: 'inhaler', label: 'Inhaler' },
      { value: 'drops', label: 'Drops' },
      { value: 'cream', label: 'Cream/Ointment' },
      { value: 'powder', label: 'Powder' },
      { value: 'other', label: 'Other' },
    ];
  };

  // Icon options
  const getIconOptions = () => {
    return [
      { value: 'pill', label: 'Pill' },
      { value: 'capsules', label: 'Capsule' },
      { value: 'tablets', label: 'Tablet' },
      { value: 'syringe', label: 'Injection' },
      { value: 'inhaler', label: 'Inhaler' },
      { value: 'drops', label: 'Drops' },
      { value: 'cream', label: 'Cream' },
      { value: 'liquid', label: 'Liquid' },
    ];
  };

  // Color options
  const getColorOptions = () => {
    return [
      { value: 'blue', label: 'Blue' },
      { value: 'green', label: 'Green' },
      { value: 'red', label: 'Red' },
      { value: 'yellow', label: 'Yellow' },
      { value: 'purple', label: 'Purple' },
      { value: 'pink', label: 'Pink' },
      { value: 'orange', label: 'Orange' },
      { value: 'gray', label: 'Gray' },
    ];
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Medication</DialogTitle>
          <DialogDescription>
            Update the details for this medication.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Medication Name</Label>
              <Input
                id="name"
                name="name"
                value={medicationData.name}
                onChange={handleInputChange}
                placeholder="Medication name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dosage">Dosage</Label>
              <Input
                id="dosage"
                name="dosage"
                value={medicationData.dosage}
                onChange={handleInputChange}
                placeholder="e.g., 10mg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                name="instructions"
                value={medicationData.instructions}
                onChange={handleInputChange}
                placeholder="Take with food, etc."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="form">Form</Label>
              <Select
                value={medicationData.form}
                onValueChange={(value) => handleSelectChange('form', value)}
              >
                <SelectTrigger id="form">
                  <SelectValue placeholder="Select form" />
                </SelectTrigger>
                <SelectContent>
                  {getMedicationFormOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Icon</Label>
              <Select
                value={medicationData.icon}
                onValueChange={(value) => handleSelectChange('icon', value)}
              >
                <SelectTrigger id="icon">
                  <SelectValue placeholder="Select icon" />
                </SelectTrigger>
                <SelectContent>
                  {getIconOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="iconColor">Icon Color</Label>
              <Select
                value={medicationData.iconColor}
                onValueChange={(value) => handleSelectChange('iconColor', value)}
              >
                <SelectTrigger id="iconColor">
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {getColorOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                This color is for visual organization only and does not represent the actual medication color.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reorderThreshold">Reorder Threshold</Label>
              <Input
                id="reorderThreshold"
                name="reorderThreshold"
                type="number"
                min="1"
                value={medicationData.reorderThreshold}
                onChange={handleNumberChange}
                placeholder="5"
              />
              <p className="text-xs text-gray-500">
                You'll be notified when inventory falls below this number.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prescriptionNumber">Prescription Number</Label>
              <Input
                id="prescriptionNumber"
                name="prescriptionNumber"
                value={medicationData.prescriptionNumber}
                onChange={handleInputChange}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="mt-2 sm:mt-0"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="mt-2 sm:mt-0"
            disabled={updateMedicationMutation.isPending}
          >
            {updateMedicationMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}