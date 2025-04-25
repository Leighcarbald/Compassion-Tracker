import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, parse } from "date-fns";
import { Pill, Utensils, Toilet, Moon } from "lucide-react";

type EventType = "medication" | "meal" | "bowel" | "appointment" | "sleep";

interface AddCareEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  careRecipientId: string | null;
  defaultEventType?: EventType;
  selectedDate?: Date;
}

const eventSchema = z.object({
  type: z.string(),
  name: z.string().min(1, "Event name is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  wakeUpTime: z.string().optional(),
  notes: z.string().optional(),
  reminder: z.boolean().default(false),
  careRecipientId: z.number().positive(),
  medicationId: z.number().positive().optional(),
  mealType: z.string().optional()
});

export default function AddCareEventModal({
  isOpen,
  onClose,
  careRecipientId,
  defaultEventType = "meal",
  selectedDate
}: AddCareEventModalProps) {
  const [eventType, setEventType] = useState<EventType>(defaultEventType);

  // Fetch medications for this care recipient
  const { data: medications = [] } = useQuery({
    queryKey: ['/api/medications', careRecipientId],
    queryFn: async () => {
      if (!careRecipientId) return [];
      const res = await fetch(`/api/medications?careRecipientId=${careRecipientId}`);
      if (!res.ok) throw new Error('Failed to fetch medications');
      return res.json();
    },
    enabled: !!careRecipientId && isOpen && eventType === "medication"
  });

  const form = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      type: defaultEventType,
      name: "",
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      time: format(new Date(), "HH:mm"),
      wakeUpTime: "",
      notes: "",
      reminder: true,
      careRecipientId: careRecipientId ? parseInt(careRecipientId) : 0,
      medicationId: undefined,
      mealType: "breakfast"
    }
  });
  
  // When the modal is opened or closed, reset the form
  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      form.reset({
        type: defaultEventType || "meal",
        name: "",
        date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        time: format(new Date(), "HH:mm"),
        wakeUpTime: "",
        notes: "",
        reminder: false,
        careRecipientId: careRecipientId ? parseInt(careRecipientId) : 0,
        medicationId: undefined,
        mealType: defaultEventType === "meal" ? "breakfast" : undefined
      });
      
      // Set initial event type
      setEventType(defaultEventType || "meal");
      
      console.log("Form reset on modal open with values:", form.getValues());
    }
  }, [isOpen, form, selectedDate, defaultEventType, careRecipientId]);
  
  // When medication is selected, update the name field
  useEffect(() => {
    const medicationId = form.watch('medicationId');
    if (medicationId && medications.length > 0) {
      const selected = medications.find((med: any) => med.id === medicationId);
      if (selected) {
        form.setValue('name', selected.name);
      }
    }
  }, [form.watch('medicationId'), medications]);

  const addEvent = useMutation({
    mutationFn: async (data: z.infer<typeof eventSchema>) => {
      if (!data.careRecipientId) {
        throw new Error("Care recipient ID is required");
      }
      
      let endpoint = "";
      let postData: any = { ...data };
      
      // Create a datetime from the date and time fields
      const dateTimeStr = `${data.date}T${data.time}:00`;
      const dateTime = new Date(dateTimeStr);
      
      switch (data.type) {
        case "medication":
          if (!data.medicationId) {
            throw new Error("Medication selection is required");
          }
          
          endpoint = "/api/medication-logs";
          postData = {
            medicationId: data.medicationId,
            scheduleId: null, // Manual entry doesn't have a schedule
            takenAt: dateTime.toISOString(),
            notes: data.notes || "",
            careRecipientId: parseInt(data.careRecipientId.toString())
          };
          console.log("Submitting medication data:", postData);
          break;
        case "meal":
          if (!data.mealType) {
            throw new Error("Meal type is required");
          }
          
          // Detailed logging to debug meal submissions
          console.log("Creating meal with data:", {
            mealType: data.mealType, 
            food: data.name,
            date: data.date,
            time: data.time,
            dateTimeStr,
            dateTimeObj: dateTime
          });
          
          endpoint = "/api/meals";
          postData = {
            type: data.mealType,
            food: data.name,
            notes: data.notes || "",
            consumedAt: dateTime.toISOString(),
            careRecipientId: parseInt(data.careRecipientId.toString())
          };
          console.log("Submitting meal data:", postData);
          break;
        case "bowel":
          // More detailed logging for bowel movement creation
          console.log("Creating bowel movement with data:", {
            type: data.name,
            date: data.date,
            time: data.time,
            dateTimeStr,
            dateTimeObj: dateTime
          });
          
          endpoint = "/api/bowel-movements";
          postData = {
            type: data.name || "Regular",
            notes: data.notes || "",
            occuredAt: dateTime.toISOString(),
            careRecipientId: parseInt(data.careRecipientId.toString())
          };
          console.log("Submitting bowel movement data:", postData);
          break;
        case "sleep":
          // Logging for sleep record creation
          console.log("Creating sleep record with data:", {
            quality: data.name,
            date: data.date,
            bedTime: data.time,
            wakeUpTime: data.wakeUpTime,
            dateTimeStr,
            dateTimeObj: dateTime
          });
          
          // Create wake up datetime if provided
          let wakeUpDateTime = null;
          if (data.wakeUpTime && data.wakeUpTime.trim() !== '') {
            const wakeUpDateTimeStr = `${data.date}T${data.wakeUpTime}:00`;
            wakeUpDateTime = new Date(wakeUpDateTimeStr);
            console.log("Created wake up datetime from:", wakeUpDateTimeStr, wakeUpDateTime);
          }
          
          endpoint = "/api/sleep";
          postData = {
            quality: data.name || "Normal",
            notes: data.notes || "",
            startTime: dateTime.toISOString(),
            endTime: wakeUpDateTime ? wakeUpDateTime.toISOString() : null,
            careRecipientId: parseInt(data.careRecipientId.toString())
          };
          console.log("Submitting sleep data:", postData);
          break;
        case "appointment":
          endpoint = "/api/appointments";
          postData = {
            title: data.name,
            date: data.date,
            time: data.time,
            notes: data.notes || "",
            reminderEnabled: data.reminder,
            careRecipientId: parseInt(data.careRecipientId.toString())
          };
          console.log("Submitting appointment data:", postData);
          break;
      }
      
      console.log(`Sending request to ${endpoint} with data:`, postData);
      
      try {
        const response = await apiRequest("POST", endpoint, postData);
        const result = await response.json();
        console.log(`${data.type} created:`, result);
        return result;
      } catch (error) {
        console.error(`Error creating ${data.type}:`, error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events/upcoming', careRecipientId] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today', careRecipientId] });
      
      // Also invalidate relevant type-specific queries
      switch (eventType) {
        case "medication":
          queryClient.invalidateQueries({ queryKey: ['/api/medications', careRecipientId] });
          queryClient.invalidateQueries({ queryKey: ['/api/medication-logs', careRecipientId] });
          break;
        case "meal":
          queryClient.invalidateQueries({ queryKey: ['/api/meals', careRecipientId] });
          break;
        case "bowel":
          queryClient.invalidateQueries({ queryKey: ['/api/bowel-movements', careRecipientId] });
          break;
        case "sleep":
          queryClient.invalidateQueries({ queryKey: ['/api/sleep', careRecipientId] });
          break;
        case "appointment":
          queryClient.invalidateQueries({ queryKey: ['/api/appointments', careRecipientId] });
          break;
      }
      
      // Reset form and close modal
      form.reset();
      onClose();
    }
  });

  const onSubmit = (data: z.infer<typeof eventSchema>) => {
    if (!careRecipientId) {
      console.error("Missing careRecipientId");
      return;
    }
    
    console.log("Submitting form with data:", {
      ...data,
      type: eventType,
      careRecipientId: parseInt(careRecipientId)
    });
    
    // Add form validation errors check
    const formErrors = form.formState.errors;
    if (Object.keys(formErrors).length > 0) {
      console.error("Form has validation errors:", formErrors);
      return;
    }
    
    // Ensure all required fields are present for the specific event type
    if (eventType === "meal" && !data.mealType) {
      console.error("Meal type is required");
      form.setError("mealType", { message: "Please select a meal type" });
      return;
    }
    
    if (!data.name || data.name.trim() === "") {
      console.error("Name/food is required");
      form.setError("name", { message: "This field is required" });
      return;
    }
    
    if (!data.date) {
      console.error("Date is required");
      form.setError("date", { message: "Please select a date" });
      return;
    }
    
    if (!data.time) {
      console.error("Time is required");
      form.setError("time", { message: "Please enter a time" });
      return;
    }
    
    try {
      // Create the date-time string for the event
      const dateTimeStr = `${data.date}T${data.time}:00`;
      console.log("Creating datetime from:", dateTimeStr);
      
      // Create submission data with appropriate fields for the event type
      let submissionData = {
        ...data,
        type: eventType,
        careRecipientId: parseInt(careRecipientId)
      };
      
      // Add event-specific fields
      if (eventType === "bowel") {
        // Ensure occuredAt is properly formatted
        submissionData = {
          ...submissionData,
          occuredAt: dateTimeStr
        };
      }
      
      console.log("Final submission data:", submissionData);
      
      addEvent.mutate(submissionData);
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  const handleTypeChange = (type: EventType) => {
    setEventType(type);
    
    // Completely reset the form when changing types to prevent data carryover
    form.reset({
      type: type,
      name: "", // Clear the name/type/food field
      date: form.getValues("date"),  // Preserve the date
      time: form.getValues("time"),  // Preserve the time
      wakeUpTime: "", // Reset wake up time
      notes: "", // Reset notes
      reminder: false,
      careRecipientId: careRecipientId ? parseInt(careRecipientId) : 0,
      medicationId: undefined,
      mealType: type === "meal" ? "breakfast" : undefined
    });
    
    console.log("Form reset to event type:", type, "with values:", form.getValues());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Care Event</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="mb-4">
              <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Event Type</FormLabel>
              <div className="grid grid-cols-3 gap-2">

                <Button
                  type="button"
                  className={`p-2 ${
                    eventType === "meal"
                      ? "bg-primary bg-opacity-10 text-primary"
                      : "bg-gray-100 text-gray-700"
                  } rounded-md flex flex-col items-center`}
                  onClick={() => handleTypeChange("meal")}
                >
                  <Utensils className="h-5 w-5 mb-1" />
                  <span className="text-xs">Meal</span>
                </Button>
                <Button
                  type="button"
                  className={`p-2 ${
                    eventType === "bowel"
                      ? "bg-primary bg-opacity-10 text-primary"
                      : "bg-gray-100 text-gray-700"
                  } rounded-md flex flex-col items-center`}
                  onClick={() => handleTypeChange("bowel")}
                >
                  <Toilet className="h-5 w-5 mb-1" />
                  <span className="text-xs">Bowel</span>
                </Button>
                <Button
                  type="button"
                  className={`p-2 ${
                    eventType === "sleep"
                      ? "bg-primary bg-opacity-10 text-primary"
                      : "bg-gray-100 text-gray-700"
                  } rounded-md flex flex-col items-center`}
                  onClick={() => handleTypeChange("sleep")}
                >
                  <Moon className="h-5 w-5 mb-1" />
                  <span className="text-xs">Sleep</span>
                </Button>
              </div>
            </div>
            
            {eventType === "medication" && (
              <FormField
                control={form.control}
                name="medicationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medication</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value?.toString()}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a medication" />
                        </SelectTrigger>
                        <SelectContent>
                          {medications.map((med: any) => (
                            <SelectItem key={med.id} value={med.id.toString()}>
                              {med.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {eventType === "meal" && (
              <FormField
                control={form.control}
                name="mealType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meal Type</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select meal type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="breakfast">Breakfast</SelectItem>
                          <SelectItem value="lunch">Lunch</SelectItem>
                          <SelectItem value="dinner">Dinner</SelectItem>
                          <SelectItem value="snack">Snack</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {eventType === "medication" 
                      ? "Description" 
                      : eventType === "meal" 
                        ? "Food" 
                        : eventType === "bowel" 
                          ? "Type" 
                          : eventType === "sleep"
                            ? "Quality"
                            : "Name"}
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={
                        eventType === "medication" ? "Morning dose" : 
                        eventType === "meal" ? "Oatmeal, toast, and orange juice" : 
                        eventType === "bowel" ? "Regular" :
                        eventType === "sleep" ? "Good, Restless, etc." :
                        "Dr. Appointment"
                      } 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {eventType === "sleep" ? (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bed Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="wakeUpTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wake Up Time</FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          {...field}
                          value={field.value || ''} 
                          placeholder="Optional - can be recorded later" 
                        />
                      </FormControl>
                      <FormDescription>
                        Optional - can be recorded later
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional details..." 
                      rows={2} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Only show reminders for appointments and medications */}
            {(eventType === "appointment" || eventType === "medication") && (
              <FormField
                control={form.control}
                name="reminder"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-sm text-gray-700">Set reminder</FormLabel>
                  </FormItem>
                )}
              />
            )}
            
            <DialogFooter className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addEvent.isPending}
              >
                {addEvent.isPending ? "Adding..." : "Add Event"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
