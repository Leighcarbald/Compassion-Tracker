import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trash2, PlusCircle, Loader2 } from "lucide-react";
import { Medication, MedicationLog } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatTime } from "@/lib/utils";

interface EditMedicationSchedulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  medication: Medication | null;
}

const scheduleItemSchema = z.object({
  id: z.number().optional(),
  medicationId: z.number().positive(),
  time: z.string().min(1, "Time is required"),
  daysOfWeek: z.array(z.number().min(0).max(6)),
  quantity: z.string().min(1, "Quantity is required"),
  withFood: z.boolean().default(false),
  active: z.boolean().default(true),
  // Still include reminderEnabled in the schema to match database, but we'll hide it in the UI
  reminderEnabled: z.boolean().default(true),
  // Add asNeeded flag for "as needed" medications
  asNeeded: z.boolean().default(false),
});

const scheduleSchema = z.object({
  schedules: z.array(scheduleItemSchema),
});

// Common time options for medication schedules (all 24 hours)
const timeOptions = [
  { value: "00:00:00", label: "12:00 AM" },
  { value: "01:00:00", label: "1:00 AM" },
  { value: "02:00:00", label: "2:00 AM" },
  { value: "03:00:00", label: "3:00 AM" },
  { value: "04:00:00", label: "4:00 AM" },
  { value: "05:00:00", label: "5:00 AM" },
  { value: "06:00:00", label: "6:00 AM" },
  { value: "07:00:00", label: "7:00 AM" },
  { value: "08:00:00", label: "8:00 AM" },
  { value: "09:00:00", label: "9:00 AM" },
  { value: "10:00:00", label: "10:00 AM" },
  { value: "11:00:00", label: "11:00 AM" },
  { value: "12:00:00", label: "12:00 PM" },
  { value: "13:00:00", label: "1:00 PM" },
  { value: "14:00:00", label: "2:00 PM" },
  { value: "15:00:00", label: "3:00 PM" },
  { value: "16:00:00", label: "4:00 PM" },
  { value: "17:00:00", label: "5:00 PM" },
  { value: "18:00:00", label: "6:00 PM" },
  { value: "19:00:00", label: "7:00 PM" },
  { value: "20:00:00", label: "8:00 PM" },
  { value: "21:00:00", label: "9:00 PM" },
  { value: "22:00:00", label: "10:00 PM" },
  { value: "23:00:00", label: "11:00 PM" },
];

// Form-specific quantity options
const quantityOptionsByForm = {
  // Pills/tablets form
  "pills": [
    { value: "1 tablet", label: "1 tablet" },
    { value: "2 tablets", label: "2 tablets" },
    { value: "1/2 tablet", label: "1/2 tablet" },
  ],
  // Capsules form
  "capsule": [
    { value: "1 capsule", label: "1 capsule" },
    { value: "2 capsules", label: "2 capsules" },
  ],
  // Liquid form
  "droplet": [
    { value: "5ml", label: "5ml" },
    { value: "10ml", label: "10ml" },
    { value: "15ml", label: "15ml" },
    { value: "1 tsp", label: "1 teaspoon" },
    { value: "1 tbsp", label: "1 tablespoon" },
  ],
  // Injection form
  "syringe": [
    { value: "1 injection", label: "1 injection" },
    { value: "0.5ml", label: "0.5ml injection" },
    { value: "1ml", label: "1ml injection" },
  ],
  // Default options for other forms
  "default": [
    { value: "1 dose", label: "1 dose" },
    { value: "2 doses", label: "2 doses" },
  ]
};

// Helper function to get quantity options based on medication form
const getQuantityOptionsForMedication = (medication: Medication | null) => {
  if (!medication) return quantityOptionsByForm.default;
  
  // Map medication icon to form type
  const formType = medication.icon || 'pills';
  
  // Return the appropriate options or default if not found
  return quantityOptionsByForm[formType as keyof typeof quantityOptionsByForm] 
    || quantityOptionsByForm.default;
};

// Days of the week options
const daysOfWeekOptions = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

export default function EditMedicationSchedulesModal({
  isOpen,
  onClose,
  medication,
}: EditMedicationSchedulesModalProps) {
  const { toast } = useToast();
  const [showCustomTime, setShowCustomTime] = useState<number[]>([]);

  const form = useForm<z.infer<typeof scheduleSchema>>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      schedules: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "schedules",
  });

  // Load existing schedules when the medication changes
  useEffect(() => {
    if (medication && medication.schedules) {
      console.log("Loading schedules:", medication.schedules);
      
      // Reset the form with the medication's schedules
      form.reset({
        schedules: medication.schedules.map(schedule => ({
          id: schedule.id, // Keep the original ID format
          medicationId: medication.id,
          time: schedule.time,
          daysOfWeek: Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [0, 1, 2, 3, 4, 5, 6],
          quantity: schedule.quantity || "1 tablet",
          withFood: schedule.withFood || false,
          active: schedule.active || true,
          reminderEnabled: schedule.reminderEnabled || true,
          asNeeded: schedule.asNeeded || false, // Add the asNeeded property
        })),
      });
      
      // Initialize the showCustomTime state
      setShowCustomTime(medication.schedules.map(schedule => 
        !timeOptions.some(option => option.value === schedule.time) ? schedule.id : -1
      ).filter(id => id !== -1));
    } else if (medication) {
      // If medication exists but has no schedules, initialize with empty array
      form.reset({
        schedules: [],
      });
      setShowCustomTime([]);
    }
  }, [medication, form]);

  // Mutation for deleting a schedule
  const deleteSchedule = useMutation({
    mutationFn: async (scheduleId: number | string) => {
      console.log(`Deleting schedule with ID ${scheduleId}`);
      const url = `/api/medication-schedules/${scheduleId}`;
      
      console.log(`API Request: DELETE ${url}`);
      const response = await apiRequest("DELETE", url);
      console.log(`API Response: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error deleting schedule: ${errorText}`);
      }
      
      return scheduleId;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/medications'] });
      
      toast({
        title: "Success",
        description: "Medication schedule deleted successfully",
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error("Error deleting schedule:", error);
      toast({
        title: "Error Deleting Schedule",
        description: error.message || "Failed to delete medication schedule. Please try again.",
        variant: "destructive",
      });
    }
  });

  const saveSchedules = useMutation({
    mutationFn: async (data: z.infer<typeof scheduleSchema>) => {
      if (!medication) throw new Error("No medication selected");
      
      console.log("Saving schedules:", data);
      
      const results = [];
      
      // Update or create each schedule
      for (const schedule of data.schedules) {
        try {
          const isNew = !schedule.id;
          const method = isNew ? "POST" : "PATCH";
          const url = isNew 
            ? "/api/medication-schedules" 
            : `/api/medication-schedules/${schedule.id}`;
          
          console.log(`API Request: ${method} ${url}`, schedule);
          const response = await apiRequest(method, url, schedule);
          console.log(`API Response: ${response.status} ${response.statusText}`);
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error ${isNew ? 'creating' : 'updating'} schedule: ${errorText}`);
          }
          
          // For PATCH responses, some servers may not return content
          // In this case, just add the schedule to results
          if (method === "PATCH" && response.status === 200) {
            try {
              // Try to parse JSON, but if it fails or is empty, use the schedule
              const text = await response.text();
              if (!text || text.trim() === '') {
                results.push(schedule);
              } else {
                results.push(JSON.parse(text));
              }
            } catch (e) {
              // If we can't parse the response as JSON, just use the schedule
              results.push(schedule);
            }
          } else {
            // Otherwise try to parse the response as JSON
            const responseData = await response.json();
            results.push(responseData);
          }
        } catch (err) {
          console.error(`Error with schedule:`, schedule, err);
          throw err;
        }
      }
      
      return results;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/medications'] });
      
      toast({
        title: "Success",
        description: "Medication schedules saved successfully",
        variant: "default",
      });
      
      onClose();
    },
    onError: (error: any) => {
      console.error("Error saving schedules:", error);
      toast({
        title: "Error Saving Schedules",
        description: error.message || "Failed to save medication schedules. Please try again.",
        variant: "destructive",
      });
    }
  });

  const addSchedule = () => {
    if (!medication) return;
    
    // Get the default quantity based on medication form type
    const medOptions = getQuantityOptionsForMedication(medication);
    const defaultQuantity = medOptions.length > 0 ? medOptions[0].value : "1 dose";
    
    append({
      medicationId: medication.id,
      time: "08:00:00", // Default to 8 AM
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Default to every day
      quantity: defaultQuantity, // Use appropriate default quantity for this medication type
      withFood: false,
      active: true,
      reminderEnabled: true, // Keep this true even though UI option is removed
      asNeeded: false, // Default to regular schedule (not as-needed)
    });
  };

  const handleTimeOptionSelect = (index: number, value: string) => {
    // If "Custom" is selected, show the custom time input
    if (value === "custom") {
      // Mark this schedule as having a custom time
      setShowCustomTime(prev => [...prev, index]);
      // Reset the time value to empty or a default
      form.setValue(`schedules.${index}.time`, "");
    } else {
      // Remove this index from showCustomTime if it exists
      setShowCustomTime(prev => prev.filter(i => i !== index));
      // Set the selected time value
      form.setValue(`schedules.${index}.time`, value);
    }
  };

  const onSubmit = (data: z.infer<typeof scheduleSchema>) => {
    console.log("Submitting schedules:", data);
    saveSchedules.mutate(data);
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
            Manage medication schedules and view history
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="schedules" className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="schedules">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {fields.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground mb-4">No schedules set for this medication.</p>
                    <Button 
                      type="button" 
                      onClick={addSchedule}
                      className="flex items-center gap-2"
                    >
                      <PlusCircle size={16} />
                      Add Schedule
                    </Button>
                  </div>
                ) : (
                  <>
                    {fields.map((field, index) => (
                      <div key={field.id} className="border rounded-lg p-4 space-y-4 relative">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 text-destructive"
                          onClick={() => {
                            const schedule = fields[index];
                            console.log("Field to delete:", schedule);
                            if (schedule.id) {
                              // Pass the ID directly without conversion
                              console.log(`Using original schedule ID format: ${schedule.id} (${typeof schedule.id})`);
                              
                              // If it has an ID, it exists in the database, so delete it
                              deleteSchedule.mutate(schedule.id, {
                                onSuccess: () => {
                                  // After deleting from server, remove from form
                                  remove(index);
                                  toast({
                                    title: "Schedule Removed",
                                    description: "Medication schedule deleted successfully",
                                    variant: "default",
                                  });
                                },
                                onError: (error) => {
                                  // If deletion fails, we'll still remove it from the form
                                  // This happens if it's a new schedule that was just added
                                  console.log("Error deleting, removing from form anyway:", error);
                                  remove(index);
                                  toast({
                                    title: "Schedule Removed",
                                    description: "Schedule removed from form. You'll need to Save to update the database.",
                                    variant: "default",
                                  });
                                }
                              });
                            } else {
                              // If no ID, it's a new schedule that doesn't exist in the database yet
                              remove(index);
                              toast({
                                title: "Schedule Removed",
                                description: "Schedule removed from form.",
                                variant: "default",
                              });
                            }
                          }}
                          disabled={deleteSchedule.isPending}
                        >
                          {deleteSchedule.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                        
                        <FormField
                          control={form.control}
                          name={`schedules.${index}.time`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Time</FormLabel>
                              {/* Wrap flex container in a margin bottom to ensure spacing */}
                              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                                <div className="w-full">
                                  <Select
                                    onValueChange={(value) => handleTimeOptionSelect(index, value)}
                                    value={
                                      showCustomTime.includes(index) 
                                        ? "custom" 
                                        : timeOptions.some(opt => opt.value === field.value)
                                          ? field.value
                                          : "custom"
                                    }
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select time" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {timeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value="custom">Custom Time</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                {showCustomTime.includes(index) && (
                                  <div className="w-full sm:w-auto">
                                    <FormControl>
                                      <Input
                                        type="time"
                                        className="w-full"
                                        {...field}
                                        onChange={(e) => {
                                          // Convert the time input (HH:MM) to HH:MM:00 format
                                          const timeValue = e.target.value + ":00";
                                          field.onChange(timeValue);
                                        }}
                                        value={field.value.slice(0, 5)} // Display only HH:MM part
                                      />
                                    </FormControl>
                                  </div>
                                )}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name={`schedules.${index}.quantity`}
                          render={({ field }) => {
                            // Get medication-specific quantity options
                            const medicationQuantityOptions = getQuantityOptionsForMedication(medication);
                            
                            return (
                              <FormItem>
                                <FormLabel>Dose Quantity</FormLabel>
                                <div className="w-full mb-2">
                                  <Select
                                    onValueChange={field.onChange}
                                    value={
                                      medicationQuantityOptions.some(opt => opt.value === field.value)
                                        ? field.value
                                        : "custom"
                                    }
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select quantity" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {medicationQuantityOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value="custom">Custom Quantity</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                {field.value === "custom" && (
                                  <div className="w-full mb-2">
                                    <FormControl>
                                      <Input 
                                        className="w-full"
                                        placeholder="Enter custom quantity" 
                                        onChange={(e) => field.onChange(e.target.value)}
                                        // Don't use the field's value if it's "custom"
                                        value=""
                                      />
                                    </FormControl>
                                  </div>
                                )}
                                
                                {field.value !== undefined && 
                                 !medicationQuantityOptions.some(opt => opt.value === field.value) && 
                                 field.value !== "custom" && (
                                  <div className="w-full mb-2">
                                    <FormControl>
                                      <Input 
                                        className="w-full"
                                        placeholder="Enter custom quantity" 
                                        {...field} 
                                      />
                                    </FormControl>
                                  </div>
                                )}
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                        
                        {/* Hide Days of Week if "As Needed" is checked */}
                        {!form.watch(`schedules.${index}.asNeeded`) && (
                          <FormField
                            control={form.control}
                            name={`schedules.${index}.daysOfWeek`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Days of Week</FormLabel>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {daysOfWeekOptions.map((day) => (
                                    <div 
                                      key={day.value}
                                      className="flex items-center space-x-2"
                                    >
                                      <Checkbox
                                        id={`day-${index}-${day.value}`}
                                        checked={field.value?.includes(day.value)}
                                        onCheckedChange={(checked) => {
                                          const currentValues = Array.isArray(field.value) ? [...field.value] : [];
                                          if (checked) {
                                            // Add the value if it's not already there
                                            if (!currentValues.includes(day.value)) {
                                              field.onChange([...currentValues, day.value].sort());
                                            }
                                          } else {
                                            // Remove the value
                                            field.onChange(currentValues.filter(v => v !== day.value));
                                          }
                                        }}
                                      />
                                      <label 
                                        htmlFor={`day-${index}-${day.value}`}
                                        className="text-xs whitespace-nowrap cursor-pointer"
                                      >
                                        {day.label.substring(0, 3)}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {/* As Needed option */}
                        <FormField
                          control={form.control}
                          name={`schedules.${index}.asNeeded`}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3">
                              <div className="space-y-0.5">
                                <FormLabel>Take As Needed</FormLabel>
                                <p className="text-xs text-muted-foreground">
                                  Instead of a regular schedule, take only when needed
                                </p>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        {/* Single column for with food option - reminder option removed */}
                        <FormField
                          control={form.control}
                          name={`schedules.${index}.withFood`}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3">
                              <div className="space-y-0.5">
                                <FormLabel>Take With Food</FormLabel>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        {/* Hidden field to keep reminderEnabled in the form data */}
                        <input 
                          type="hidden" 
                          {...form.register(`schedules.${index}.reminderEnabled`)} 
                          value="true" 
                        />
                      </div>
                    ))}
                    
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full flex items-center justify-center gap-2 mt-4"
                      onClick={addSchedule}
                    >
                      <PlusCircle size={16} />
                      Add Another Time
                    </Button>
                  </>
                )}
                
                <DialogFooter className="flex flex-col sm:flex-row justify-end gap-3 pt-4 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveSchedules.isPending || fields.length === 0}
                    className="w-full sm:w-auto"
                  >
                    {saveSchedules.isPending ? "Saving..." : "Save Schedules"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
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