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
import { Pill, Utensils, Toilet } from "lucide-react";

type EventType = "medication" | "meal" | "bowel" | "appointment";

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
  defaultEventType = "medication",
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
      notes: "",
      reminder: true,
      careRecipientId: careRecipientId ? parseInt(careRecipientId) : 0,
      medicationId: undefined,
      mealType: "breakfast"
    }
  });
  
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
      let endpoint = "";
      let postData = { ...data };
      
      // Create a datetime from the date and time fields
      const dateTimeStr = `${data.date}T${data.time}:00`;
      const dateTime = new Date(dateTimeStr);
      
      switch (data.type) {
        case "medication":
          endpoint = "/api/medication-logs";
          postData = {
            medicationId: data.medicationId,
            scheduleId: null, // Manual entry doesn't have a schedule
            takenAt: dateTime.toISOString(),
            notes: data.notes || "",
            careRecipientId: data.careRecipientId
          };
          break;
        case "meal":
          endpoint = "/api/meals";
          postData = {
            type: data.mealType,
            food: data.name,
            notes: data.notes || "",
            consumedAt: dateTime.toISOString(),
            careRecipientId: data.careRecipientId
          };
          break;
        case "bowel":
          endpoint = "/api/bowel-movements";
          postData = {
            type: data.name,
            notes: data.notes || "",
            occuredAt: dateTime.toISOString(),
            careRecipientId: data.careRecipientId
          };
          console.log("Submitting bowel movement data:", postData);
          break;
        case "appointment":
          endpoint = "/api/appointments";
          postData = {
            title: data.name,
            date: data.date,
            time: data.time,
            notes: data.notes || "",
            reminderEnabled: data.reminder,
            careRecipientId: data.careRecipientId
          };
          break;
      }
      
      const response = await apiRequest("POST", endpoint, postData);
      return response.json();
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
    if (!careRecipientId) return;
    
    console.log("Submitting form with data:", {
      ...data,
      type: eventType,
      careRecipientId: parseInt(careRecipientId)
    });
    
    addEvent.mutate({
      ...data,
      type: eventType,
      careRecipientId: parseInt(careRecipientId)
    });
  };

  const handleTypeChange = (type: EventType) => {
    setEventType(type);
    form.setValue("type", type);
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
                    eventType === "medication"
                      ? "bg-primary bg-opacity-10 text-primary"
                      : "bg-gray-100 text-gray-700"
                  } rounded-md flex flex-col items-center`}
                  onClick={() => handleTypeChange("medication")}
                >
                  <Pill className="h-5 w-5 mb-1" />
                  <span className="text-xs">Medication</span>
                </Button>
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
                          : "Name"}
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={
                        eventType === "medication" ? "Morning dose" : 
                        eventType === "meal" ? "Oatmeal, toast, and orange juice" : 
                        eventType === "bowel" ? "Regular" :
                        "Dr. Appointment"
                      } 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
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
