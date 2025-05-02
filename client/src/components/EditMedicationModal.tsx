import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatTime } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

interface EditMedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  medication: Medication | null;
}

export default function EditMedicationModal({
  isOpen,
  onClose,
  medication
}: EditMedicationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [medicationData, setMedicationData] = useState({
    name: "",
    dosage: "",
    instructions: ""
  });

  // Load existing data when medication changes
  useEffect(() => {
    if (medication) {
      setMedicationData({
        name: medication.name || "",
        dosage: medication.dosage || "",
        instructions: medication.instructions || ""
      });
    }
  }, [medication]);

  const updateMedicationMutation = useMutation({
    mutationFn: async (data: typeof medicationData) => {
      if (!medication) return null;
      
      const response = await apiRequest(
        "PATCH", 
        `/api/medications/${medication.id}`,
        { ...medication, ...data }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Medication Updated",
        description: "Medication has been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/medications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today', medication?.careRecipientId?.toString()] });
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
    setMedicationData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = () => {
    updateMedicationMutation.mutate(medicationData);
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
          <DialogTitle>{medication.name}</DialogTitle>
          <DialogDescription>
            Edit medication details and view history
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="name">Medication Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={medicationData.name}
                  onChange={handleInputChange}
                  className="w-full"
                />
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="dosage">Dosage</Label>
                <Input
                  id="dosage"
                  name="dosage"
                  value={medicationData.dosage}
                  onChange={handleInputChange}
                  className="w-full"
                  placeholder="e.g., 10mg"
                />
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="instructions">Instructions</Label>
                <Textarea
                  id="instructions"
                  name="instructions"
                  value={medicationData.instructions}
                  onChange={handleInputChange}
                  className="w-full"
                  placeholder="Special instructions"
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button
                variant="outline"
                onClick={onClose}
                className="sm:order-1 w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                className="sm:order-2 w-full sm:w-auto"
                disabled={updateMedicationMutation.isPending}
              >
                {updateMedicationMutation.isPending ? "Saving..." : "Save Changes"}
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