import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Medication, MedicationLog } from "@shared/schema";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatTime } from "@/lib/utils";

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
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today', medication?.careRecipientId?.toString()] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today', medication?.careRecipientId?.toString()] });
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

  // Fetch medication logs
  const { data: medicationLogs } = useQuery<MedicationLog[]>({
    queryKey: ['/api/medication-logs', medication?.careRecipientId],
    enabled: !!medication?.careRecipientId,
  });

  // Filter logs for current medication
  const filteredLogs = medicationLogs?.filter(log => log.medicationId === medication?.id) || [];

  if (!medication) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {medication.name}
          </DialogTitle>
          <DialogDescription>
            Update inventory and view medication history
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="inventory" className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="inventory" className="space-y-4">
            <div className="grid gap-4 py-2">
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
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleRefill}
                className="sm:order-1 w-full sm:w-auto"
                disabled={updateInventoryMutation.isPending || refillMutation.isPending}
              >
                Refill Medication
              </Button>
              <Button 
                onClick={handleSubmit}
                className="sm:order-2 w-full sm:w-auto"
                disabled={updateInventoryMutation.isPending || refillMutation.isPending}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </TabsContent>
          
          <TabsContent value="history">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Medication History</h3>
              
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No medication history available.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="border rounded-md p-3">
                      <div className="flex justify-between items-center">
                        <div className="font-medium">
                          {log.taken ? "Taken" : "Skipped"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(new Date(log.takenAt))}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Time: {formatTime(new Date(log.takenAt))}
                      </div>
                      {log.notes && (
                        <div className="text-sm mt-1">
                          Notes: {log.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}