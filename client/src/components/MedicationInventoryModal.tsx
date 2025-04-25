import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Medication } from "@shared/schema";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

interface MedicationInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  medication: Medication | null;
}

export default function MedicationInventoryModal({
  isOpen,
  onClose,
  medication
}: MedicationInventoryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [inventoryData, setInventoryData] = useState({
    currentQuantity: 0,
    reorderThreshold: 5,
    daysToReorder: 7, // Default to 7 days
    originalQuantity: 0,
    refillsRemaining: 0
  });

  // Load existing data when medication changes
  useEffect(() => {
    if (medication) {
      setInventoryData({
        currentQuantity: medication.currentQuantity || 0,
        reorderThreshold: medication.reorderThreshold || 5,
        daysToReorder: medication.daysToReorder || 7,
        originalQuantity: medication.originalQuantity || 0,
        refillsRemaining: medication.refillsRemaining || 0
      });
    }
  }, [medication]);

  const updateInventoryMutation = useMutation({
    mutationFn: async (data: typeof inventoryData) => {
      if (!medication) return null;
      
      const response = await apiRequest(
        "PATCH", 
        `/api/medications/${medication.id}/inventory`,
        data
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Inventory Updated",
        description: "Medication inventory has been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/medications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/medications/reorder-alerts'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update inventory: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const refillMutation = useMutation({
    mutationFn: async (refillAmount: number) => {
      if (!medication) return null;
      
      const response = await apiRequest(
        "POST", 
        `/api/medications/${medication.id}/refill`,
        { refillAmount, refillDate: new Date() }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Medication Refilled",
        description: "Medication has been refilled successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/medications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/medications/reorder-alerts'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to refill medication: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInventoryData(prev => ({
      ...prev,
      [name]: parseInt(value) || 0
    }));
  };

  const handleDaysToReorderChange = (value: number) => {
    setInventoryData(prev => ({
      ...prev,
      daysToReorder: value
    }));
  };

  const handleSubmit = () => {
    updateInventoryMutation.mutate(inventoryData);
  };

  const handleRefill = () => {
    if (inventoryData.originalQuantity > 0) {
      refillMutation.mutate(inventoryData.originalQuantity);
    } else {
      toast({
        title: "Error",
        description: "Please set an original quantity value first",
        variant: "destructive"
      });
    }
  };

  if (!medication) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {medication.name} - Inventory Management
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 items-center gap-4">
            <Label htmlFor="currentQuantity">Current Quantity</Label>
            <Input
              id="currentQuantity"
              name="currentQuantity"
              type="number"
              min="0"
              value={inventoryData.currentQuantity}
              onChange={handleInputChange}
            />
          </div>
          
          <div className="grid grid-cols-2 items-center gap-4">
            <Label htmlFor="reorderThreshold">Reorder Threshold</Label>
            <Input
              id="reorderThreshold"
              name="reorderThreshold"
              type="number"
              min="1"
              value={inventoryData.reorderThreshold}
              onChange={handleInputChange}
            />
          </div>
          
          <div className="grid grid-cols-2 items-center gap-4">
            <Label htmlFor="daysToReorder">Days to Reorder (1-30)</Label>
            <div className="flex flex-col gap-2">
              <Slider 
                id="daysToReorder"
                min={1} 
                max={30} 
                step={1}
                value={[inventoryData.daysToReorder]}
                onValueChange={(values) => handleDaysToReorderChange(values[0])}
              />
              <div className="text-sm text-center">
                {inventoryData.daysToReorder} {inventoryData.daysToReorder === 1 ? 'day' : 'days'}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 items-center gap-4">
            <Label htmlFor="originalQuantity">Original Prescription Quantity</Label>
            <Input
              id="originalQuantity"
              name="originalQuantity"
              type="number"
              min="0"
              value={inventoryData.originalQuantity}
              onChange={handleInputChange}
            />
          </div>
          
          <div className="grid grid-cols-2 items-center gap-4">
            <Label htmlFor="refillsRemaining">Refills Remaining</Label>
            <Input
              id="refillsRemaining"
              name="refillsRemaining"
              type="number"
              min="0"
              value={inventoryData.refillsRemaining}
              onChange={handleInputChange}
            />
          </div>
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleRefill}
            className="sm:order-1"
            disabled={updateInventoryMutation.isPending || refillMutation.isPending}
          >
            Refill Medication
          </Button>
          <Button 
            onClick={handleSubmit}
            className="sm:order-2"
            disabled={updateInventoryMutation.isPending || refillMutation.isPending}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}