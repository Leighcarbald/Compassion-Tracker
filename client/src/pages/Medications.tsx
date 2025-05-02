import React, { useState } from "react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import AddCareEventModal from "@/components/AddCareEventModal";
import MedicationInventoryModal from "@/components/MedicationInventoryModal";
import AddMedicationModal from "@/components/AddMedicationModal";
import EditMedicationSchedulesModal from "@/components/EditMedicationSchedulesModal";
import EditMedicationModal from "@/components/EditMedicationModal";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MedicationLog, CareRecipient, Medication, MedicationSchedule } from "@shared/schema";
import { TabType } from "@/lib/types";
import { formatTime, getTimeAgo } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCareRecipient } from "@/hooks/use-care-recipient";
import { 
  Pill, 
  Check, 
  PillBottle, 
  Tablets, 
  Package2,
  Plus,
  Edit,
  Save,
  X,
  AlertTriangle
} from "lucide-react";

// Define a type that includes the schedules array
interface MedicationWithSchedules extends Medication {
  schedules?: MedicationSchedule[];
}

interface MedicationsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function Medications({ activeTab, setActiveTab }: MedicationsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddMedicationModalOpen, setIsAddMedicationModalOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<MedicationWithSchedules | null>(null);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isSchedulesModalOpen, setIsSchedulesModalOpen] = useState(false);
  const [isEditMedicationModalOpen, setIsEditMedicationModalOpen] = useState(false);
  // Track taken medication doses by schedule
  const [takenMedicationDoses, setTakenMedicationDoses] = useState<Map<string, boolean>>(new Map());
  const { toast } = useToast();
  
  // Use the global care recipient context
  const { activeCareRecipientId, careRecipients, isLoading: isLoadingRecipients } = useCareRecipient();

  // Fetch medications with their schedules
  const { data: medications, isLoading: isLoadingMedications } = useQuery<MedicationWithSchedules[]>({
    queryKey: ['/api/medications', activeCareRecipientId, 'all'],
    enabled: !!activeCareRecipientId,
  });

  // Fetch medication logs (history)
  const { data: medicationLogs } = useQuery<MedicationLog[]>({
    queryKey: ['/api/medication-logs', activeCareRecipientId],
    enabled: !!activeCareRecipientId,
  });
  
  // Update the taken medication doses map whenever logs change
  React.useEffect(() => {
    if (medicationLogs && medicationLogs.length > 0) {
      // Check which medication doses were taken today
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      // Create a map of medication+schedule combinations that have been taken today
      const takenDosesMap = new Map<string, boolean>();
      
      medicationLogs
        .filter(log => new Date(log.takenAt) >= startOfToday)
        .forEach(log => {
          // If the log has a scheduleId, use that to create a unique key
          if (log.scheduleId) {
            takenDosesMap.set(`${log.medicationId}-${log.scheduleId}`, true);
          } else {
            // For logs without scheduleId (taken manually), only mark the medication as taken with key '0'
            // We no longer auto-mark all scheduled times as taken when a manual log exists
            takenDosesMap.set(`${log.medicationId}-0`, true);
          }
        });
      
      setTakenMedicationDoses(takenDosesMap);
    }
  }, [medicationLogs, medications]);

  // Handle modal open/close
  const handleAddEvent = () => {
    setIsModalOpen(true);
  };

  // We're now using global context for care recipient
  const { setActiveCareRecipientId } = useCareRecipient();

  // Handle updating inventory
  const handleInventoryUpdate = (medicationId: number) => {
    const medication = medications?.find(med => med.id === medicationId) || null;
    if (medication) {
      setSelectedMedication(medication);
      setIsInventoryModalOpen(true);
    }
  };

  // Handle marking a medication dose as taken
  const markAsTakenMutation = useMutation({
    mutationFn: async ({ medicationId, scheduleId }: { medicationId: number, scheduleId?: number }) => {
      if (!activeCareRecipientId) return null;
      
      const response = await apiRequest(
        "POST", 
        `/api/medication-logs`,
        {
          medicationId,
          scheduleId,
          careRecipientId: parseInt(activeCareRecipientId),
          taken: true,
          takenAt: new Date(),
          notes: scheduleId ? `Taken at scheduled time` : "Taken manually"
        }
      );
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Medication Taken",
        description: "Successfully logged the medication as taken"
      });
      
      // We no longer need to update the local state here because we've already 
      // updated it in the handleMarkDoseAsTaken function before making the API call.
      // This prevents the issue where checked boxes disappear after navigation.
      
      // Just refresh the data without modifying local state
      queryClient.invalidateQueries({ queryKey: ['/api/medication-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/medications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to log medication: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Add unmark medication mutation
  const unmarkAsTakenMutation = useMutation({
    mutationFn: async ({ medicationId, scheduleId }: { medicationId: number, scheduleId?: number }) => {
      if (!activeCareRecipientId) return null;
      
      // Find today's log for this medication+schedule to delete
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      console.log('Trying to unmark medication:', { medicationId, scheduleId });
      console.log('Available logs:', medicationLogs);
      
      // The previous method was looking for exact scheduleId match, but for logs where 
      // scheduleId is null this doesn't work correctly. Let's improve the logic:
      // Since we no longer mark all schedules as taken when a manual dose is logged,
      // we need to look specifically for a log with the exact matching scheduleId
      const todayLog = medicationLogs?.find(log => {
        // Match by medication ID
        if (log.medicationId !== medicationId) return false;
        
        // Exact match for schedule ID (if we're looking for scheduleId=5, we want a log with scheduleId=5)
        if (scheduleId) {
          if (log.scheduleId !== scheduleId) return false;
        } else {
          // If we're looking for scheduleId=0 (manual log), match logs with null scheduleId
          if (log.scheduleId !== null) return false;
        }
        
        // Match by date (only today's logs)
        const logDate = new Date(log.takenAt);
        const isFromToday = logDate >= startOfToday;
        return isFromToday;
      });
      
      console.log('Found log to delete:', todayLog);
      
      if (!todayLog) {
        console.warn("No log found for today to delete");
        // Instead of throwing an error, we'll manually remove the dose from our local state
        // This ensures the UI updates even if we can't find the log
        return { success: true, message: 'Medication unmarked (no log found)' };
      }
      
      // Delete the log
      const response = await apiRequest(
        "DELETE",
        `/api/medication-logs/${todayLog.id}`
      );
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Medication Unmarked",
        description: "Successfully unmarked the medication dose"
      });
      
      // We no longer need to update the local state here because we've already 
      // updated it in the handleMarkDoseAsTaken function before making the API call.
      // This prevents the issue where unchecked boxes re-appear after navigation.
      
      // Just refresh the data without modifying local state
      queryClient.invalidateQueries({ queryKey: ['/api/medication-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/medications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to unmark medication: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Check if a specific medication dose has been taken
  const isDoseTaken = (medicationId: number, scheduleId: number | null) => {
    const key = `${medicationId}-${scheduleId || 0}`;
    return takenMedicationDoses.has(key);
  };

  // Handle marking a medication dose as taken
  const handleMarkDoseAsTaken = (medicationId: number, scheduleId?: number) => {
    const key = `${medicationId}-${scheduleId || 0}`;
    
    // If the dose is already taken, unmark it
    if (takenMedicationDoses.has(key)) {
      // Update local state immediately to reflect the change
      const updatedMap = new Map(takenMedicationDoses);
      updatedMap.delete(key);
      setTakenMedicationDoses(updatedMap);
      
      // Then make the API call
      unmarkAsTakenMutation.mutate({ medicationId, scheduleId });
    } else {
      // Otherwise, mark it as taken - update local state first
      const updatedMap = new Map(takenMedicationDoses);
      updatedMap.set(key, true);
      setTakenMedicationDoses(updatedMap);
      
      // Then make the API call
      markAsTakenMutation.mutate({ medicationId, scheduleId });
    }
  };

  // Function to edit a medication via modal
  const handleEditMedication = (medication: MedicationWithSchedules) => {
    setSelectedMedication(medication);
    setIsEditMedicationModalOpen(true);
  };
  
  // Handle editing schedules
  const handleEditSchedules = (medicationId: number) => {
    const medication = medications?.find(med => med.id === medicationId) || null;
    if (medication) {
      setSelectedMedication(medication);
      setIsSchedulesModalOpen(true);
    }
  };

  // Render medication icon based on the type
  const renderMedicationIcon = (type: string, color: string) => {
    const iconProps = { className: `text-${color}-500`, size: 20 };
    
    switch (type) {
      case "pills":
        return <PillBottle {...iconProps} />;
      case "tablets":
        return <Tablets {...iconProps} />;
      case "capsules":
        return <Package2 {...iconProps} />;
      default:
        return <Pill {...iconProps} />;
    }
  };

  return (
    <TooltipProvider>
      <PageHeader title="Medications" icon={<Pill />} />
      
      <main className="flex-1 overflow-auto pb-16">
        <section className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Medications</h2>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="text-primary" 
                onClick={() => setIsAddMedicationModalOpen(true)}
              >
                Add Medication <Plus className="ml-1 h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="text-primary" 
                onClick={() => setIsModalOpen(true)}
              >
                Log Medication Dose <Plus className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filter section removed as medical history shows this information */}

          {/* Medication List */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 mb-6">
            {isLoadingMedications ? (
              <div className="p-8 text-center text-gray-500">Loading medications...</div>
            ) : !medications || medications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No medications found</div>
            ) : (
              medications.map((med) => (
                <div key={med.id} className="p-3 border-b border-gray-100">
                  <div className="flex items-start mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`w-10 h-10 rounded-full bg-${med.iconColor ? med.iconColor.replace('#', '') : 'gray'}-100 flex items-center justify-center mr-3 cursor-help`}>
                          {renderMedicationIcon(med.icon || 'pill', med.iconColor ? med.iconColor.replace('#', '') : 'gray')}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>The color is for visual organization only and does not represent the actual medication color.</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex-1">
                      {/* Display mode for the medication */}
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-medium">{med.name}</div>
                          <div className="text-xs text-gray-500">{med.dosage}</div>
                        </div>
                        {med.currentQuantity !== undefined && med.currentQuantity !== null && med.currentQuantity <= (med.reorderThreshold || 5) ? (
                          <div className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Reorder Soon
                          </div>
                        ) : (
                          <div className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            In Stock
                          </div>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {med.instructions || "Take as directed"}
                      </div>
                      
                      {/* Schedules Section - Display medication schedules */}
                      {med.schedules && Array.isArray(med.schedules) && med.schedules.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {med.schedules.map((schedule: MedicationSchedule) => (
                            <Button
                              key={schedule.id}
                              size="sm"
                              variant={isDoseTaken(med.id, schedule.id) ? "default" : "outline"}
                              className={`text-xs py-0.5 px-2 h-auto rounded-full ${
                                isDoseTaken(med.id, schedule.id)
                                  ? "bg-green-600 text-white border-green-600"
                                  : "text-primary border border-primary"
                              }`}
                              onClick={() => handleMarkDoseAsTaken(med.id, schedule.id)}
                            >
                              {schedule.time?.toString().slice(0, 5) || "Take"}
                              {isDoseTaken(med.id, schedule.id) && (
                                <Check className="ml-1 h-3 w-3" />
                              )}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-gray-500 italic">
                          No scheduled doses
                        </div>
                      )}
                      
                      {/* Inventory Section */}
                      <div className="mt-2 p-2 bg-gray-50 rounded-md text-xs">
                        <div className="flex justify-between text-gray-600">
                          <span>Quantity: {med.currentQuantity || 0}</span>
                          <span>Refills: {med.refillsRemaining || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex justify-between mt-2">
                    <div className="flex gap-2 flex-wrap">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs font-medium text-blue-500 px-2 py-1 rounded-full border border-blue-500"
                        onClick={() => handleInventoryUpdate(med.id)}
                      >
                        Update Inventory
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs font-medium text-green-500 px-2 py-1 rounded-full border border-green-500"
                        onClick={() => handleEditMedication(med)}
                      >
                        <Edit className="mr-1 h-3 w-3" /> Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs font-medium text-purple-500 px-2 py-1 rounded-full border border-purple-500"
                        onClick={() => handleEditSchedules(med.id)}
                      >
                        Edit Schedules
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Medication History */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-md font-medium">Medication History</h3>
              <Button variant="link" size="sm" className="text-primary">See All</Button>
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              {!medicationLogs || medicationLogs.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No medication history</div>
              ) : (
                medicationLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="p-3 border-b border-gray-100 text-sm">
                    <div className="flex justify-between">
                      <div>
                        {medications?.find(med => med.id === log.medicationId)?.name || `Med #${log.medicationId}`} - {log.notes}
                      </div>
                      <div className="text-xs text-gray-500">{getTimeAgo(log.takenAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
      
      <BottomNavigation 
        activeTab={activeTab} 
        onChangeTab={setActiveTab} 
        onAddEvent={handleAddEvent}
      />

      <AddCareEventModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        careRecipientId={activeCareRecipientId}
        defaultEventType="medication"
      />
      
      {/* Inventory Management Modal */}
      <MedicationInventoryModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
        medication={selectedMedication}
      />
      
      {/* Add Medication Modal */}
      <AddMedicationModal
        isOpen={isAddMedicationModalOpen}
        onClose={() => setIsAddMedicationModalOpen(false)}
        careRecipientId={activeCareRecipientId}
      />
      
      {/* Edit Medication Schedules Modal */}
      <EditMedicationSchedulesModal
        isOpen={isSchedulesModalOpen}
        onClose={() => setIsSchedulesModalOpen(false)}
        medication={selectedMedication}
      />
      
      {/* Edit Medication Modal */}
      <EditMedicationModal
        isOpen={isEditMedicationModalOpen}
        onClose={() => setIsEditMedicationModalOpen(false)}
        medication={selectedMedication}
      />
    </TooltipProvider>
  );
}
