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
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trash2, PlusCircle, Loader2 } from "lucide-react";
import { Medication } from "@shared/schema";

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
  reminderEnabled: z.boolean().default(true),
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

// Common quantity options
const quantityOptions = [
  { value: "1 tablet", label: "1 tablet" },
  { value: "2 tablets", label: "2 tablets" },
  { value: "1 capsule", label: "1 capsule" },
  { value: "2 capsules", label: "2 capsules" },
  { value: "5ml", label: "5ml" },
  { value: "10ml", label: "10ml" },
  { value: "1 tsp", label: "1 teaspoon" },
  { value: "1 tbsp", label: "1 tablespoon" },
  { value: "1 injection", label: "1 injection" },
];

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
      // Reset the form with the medication's schedules
      form.reset({
        schedules: medication.schedules.map(schedule => ({
          id: schedule.id,
          medicationId: medication.id,
          time: schedule.time,
          daysOfWeek: Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [0, 1, 2, 3, 4, 5, 6],
          quantity: schedule.quantity || "1 tablet",
          withFood: schedule.withFood || false,
          active: schedule.active || true,
          reminderEnabled: schedule.reminderEnabled || true,
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
    mutationFn: async (scheduleId: number) => {
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
    
    append({
      medicationId: medication.id,
      time: "08:00:00", // Default to 8 AM
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Default to every day
      quantity: "1 tablet", // Default quantity
      withFood: false,
      active: true,
      reminderEnabled: true,
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

  if (!medication) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Medication Schedules</DialogTitle>
          <DialogDescription>
            Set the times and days when {medication.name} should be taken.
          </DialogDescription>
        </DialogHeader>
        
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
                  <div key={field.id} className="border rounded-lg p-4 space-y-3 relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 text-destructive"
                      onClick={() => {
                        const schedule = fields[index];
                        console.log("Field to delete:", schedule);
                        if (schedule.id) {
                          // Make sure the ID is in the correct format (number)
                          const scheduleId = typeof schedule.id === 'number' 
                            ? schedule.id 
                            : parseInt(String(schedule.id));
                          
                          console.log(`Converting schedule ID from ${schedule.id} (${typeof schedule.id}) to ${scheduleId} (${typeof scheduleId})`);
                          
                          if (isNaN(scheduleId)) {
                            console.error("Invalid schedule ID format:", schedule.id);
                            toast({
                              title: "Error",
                              description: "Cannot delete schedule: Invalid ID format",
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          // If it has an ID, it exists in the database, so delete it
                          deleteSchedule.mutate(scheduleId, {
                            onSuccess: () => {
                              // After deleting from server, remove from form
                              remove(index);
                            }
                          });
                        } else {
                          // If no ID, it's a new schedule that doesn't exist in the database yet
                          remove(index);
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
                          <div className="flex gap-2">
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
                            
                            {showCustomTime.includes(index) && (
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  onChange={(e) => {
                                    // Convert the time input (HH:MM) to HH:MM:00 format
                                    const timeValue = e.target.value + ":00";
                                    field.onChange(timeValue);
                                  }}
                                  value={field.value.slice(0, 5)} // Display only HH:MM part
                                />
                              </FormControl>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name={`schedules.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dose Quantity</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={
                              quantityOptions.some(opt => opt.value === field.value)
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
                              {quantityOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                              <SelectItem value="custom">Custom Quantity</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {field.value !== undefined && 
                           !quantityOptions.some(opt => opt.value === field.value) && (
                            <FormControl>
                              <Input 
                                className="mt-2"
                                placeholder="Enter custom quantity" 
                                {...field} 
                              />
                            </FormControl>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
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
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`schedules.${index}.withFood`}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3">
                            <div className="space-y-0.5">
                              <FormLabel>With Food</FormLabel>
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
                      
                      <FormField
                        control={form.control}
                        name={`schedules.${index}.reminderEnabled`}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3">
                            <div className="space-y-0.5">
                              <FormLabel>Reminders</FormLabel>
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
                    </div>
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={addSchedule}
                >
                  <PlusCircle size={16} />
                  Add Another Time
                </Button>
              </>
            )}
            
            <DialogFooter className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveSchedules.isPending || fields.length === 0}
              >
                {saveSchedules.isPending ? "Saving..." : "Save Schedules"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}