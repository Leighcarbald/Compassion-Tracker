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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Trash2
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
  // State for delete confirmation dialogs
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleteMedicationConfirmOpen, setIsDeleteMedicationConfirmOpen] = useState(false);
  const [logToDelete, setLogToDelete] = useState<MedicationLog | null>(null);
  const [medicationToDelete, setMedicationToDelete] = useState<MedicationWithSchedules | null>(null);
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
  
  // Handle deleting a medication log
  const deleteMedicationLogMutation = useMutation({
    mutationFn: async (logId: number) => {
      const response = await apiRequest(
        "DELETE",
        `/api/medication-logs/${logId}`
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Log Deleted",
        description: "Successfully deleted the medication log entry"
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/medication-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/medications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today'] });
      
      setIsDeleteConfirmOpen(false);
      setLogToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete log: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Handle confirmation to delete log
  const handleDeleteLog = (log: MedicationLog) => {
    setLogToDelete(log);
    setIsDeleteConfirmOpen(true);
  };
  
  // Handle confirmed deletion
  const confirmDeleteLog = () => {
    if (logToDelete) {
      deleteMedicationLogMutation.mutate(logToDelete.id);
    }
  };
  
  // Delete medication mutation
  const deleteMedicationMutation = useMutation({
    mutationFn: async (medicationId: number) => {
      const response = await apiRequest(
        "DELETE",
        `/api/medications/${medicationId}`
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Medication Deleted",
        description: "Successfully deleted the medication"
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/medications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/medication-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/upcoming-events'] });
      
      setIsDeleteMedicationConfirmOpen(false);
      setMedicationToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete medication: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Handle delete medication click
  const handleDeleteMedication = (medication: MedicationWithSchedules) => {
    setMedicationToDelete(medication);
    setIsDeleteMedicationConfirmOpen(true);
  };
  
  // Handle confirm delete medication
  const confirmDeleteMedication = () => {
    if (medicationToDelete) {
      deleteMedicationMutation.mutate(medicationToDelete.id);
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
              {/* "Record Taken" button removed */}
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
                <div key={med.id} className="p-4 border-b border-gray-100">
                  <div className="flex items-start">
                    <div className={`w-12 h-12 rounded-full bg-${med.iconColor?.replace('#', '') || 'gray'}-100 flex items-center justify-center mr-3 flex-shrink-0`}>
                      {renderMedicationIcon(med.icon || 'pills', med.iconColor?.replace('#', '') || 'gray')}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-lg font-medium">{med.name}</div>
                          <div className="text-sm text-gray-600">{med.dosage}</div>
                        </div>
                        <div className="flex space-x-2">
                          {med.currentQuantity !== undefined && med.currentQuantity <= (med.reorderThreshold || 5) ? (
                            <div className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                              Low Inventory
                            </div>
                          ) : (
                            <div className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-600">
                              In Stock: {med.currentQuantity}
                            </div>
                          )}
                          
                          {med.refillsRemaining !== undefined && med.refillsRemaining > 0 && (
                            <div className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                              Refills: {med.refillsRemaining}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Instructions */}
                      {med.instructions && (
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Instructions:</span> {med.instructions}
                        </div>
                      )}
                      
                      {/* Display scheduled doses */}
                      {med.schedules && Array.isArray(med.schedules) && med.schedules.length > 0 ? (
                        <div className="mt-3">
                          <div className="text-sm font-medium mb-1">Schedule:</div>
                          <div className="flex flex-wrap gap-2">
                            {med.schedules.map(schedule => (
                              <Tooltip key={schedule.id}>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant={isDoseTaken(med.id, schedule.id) ? "default" : "outline"}
                                    className={`text-xs py-0.5 px-2 h-auto min-w-[60px] ${
                                      isDoseTaken(med.id, schedule.id)
                                        ? "bg-green-600 text-white"
                                        : "border border-primary"
                                    }`}
                                    onClick={() => handleMarkDoseAsTaken(med.id, schedule.id)}
                                  >
                                    {schedule.asNeeded 
                                      ? "As Needed" 
                                      : (schedule.time ? formatTime(schedule.time) : "Unknown")}
                                    {isDoseTaken(med.id, schedule.id) && (
                                      <Check className="ml-1 h-3 w-3" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {isDoseTaken(med.id, schedule.id)
                                      ? "Click to unmark as taken"
                                      : "Click to mark as taken"}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-gray-400 italic">No schedule set</div>
                      )}
                      
                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {/* "Record Taken" button removed */}
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
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs font-medium text-red-500 px-2 py-1 rounded-full border border-red-500"
                          onClick={() => handleDeleteMedication(med)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" /> Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Medication History */}
          <h3 className="text-lg font-medium mb-3">Medication History</h3>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 mb-6">
            {!medicationLogs || medicationLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No medication history</div>
            ) : (
              <div>
                {medicationLogs.slice(0, 10).map(log => {
                  const medication = medications?.find(m => m.id === log.medicationId);
                  
                  return (
                    <div 
                      key={log.id} 
                      className="p-3 border-b border-gray-100 flex justify-between items-center"
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                          <Pill className="h-4 w-4 text-gray-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            {medication?.name || "Unknown medication"}
                            <span className="ml-2 text-xs font-normal text-gray-500">
                              {log.dose || medication?.dosage}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(log.takenAt).toLocaleString()}
                            <span className="ml-2 text-gray-400">
                              ({getTimeAgo(new Date(log.takenAt))})
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 h-8 w-8 p-0"
                        onClick={() => handleDeleteLog(log)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                
                {medicationLogs.length > 10 && (
                  <div className="p-3 text-center">
                    <Button variant="link" size="sm">
                      View all {medicationLogs.length} entries
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
      
      <BottomNavigation activeTab={activeTab} />
      
      {/* Modals */}
      <AddMedicationModal 
        isOpen={isAddMedicationModalOpen} 
        onClose={() => setIsAddMedicationModalOpen(false)} 
        careRecipientId={activeCareRecipientId}
      />
      
      <AddCareEventModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMedication(null);
        }} 
        careRecipientId={activeCareRecipientId}
        defaultEventType="medication"
        hideCategorySelector={false}
        defaultMedicationId={selectedMedication?.id}
      />
      
      {/* Inventory Management Modal */}
      <MedicationInventoryModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
        medication={selectedMedication}
      />
      
      {/* Edit Schedules Modal */}
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
        careRecipientId={activeCareRecipientId}
      />
      
      {/* Delete Log Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Medication Log</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this medication log entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLog}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Medication Confirmation Dialog */}
      <AlertDialog open={isDeleteMedicationConfirmOpen} onOpenChange={setIsDeleteMedicationConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Medication</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {medicationToDelete?.name}? This will also delete all schedules and history for this medication. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMedication}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}