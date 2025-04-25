import { useState } from "react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Pill, Utensils, Thermometer } from "lucide-react";

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
  careRecipientId: z.number().positive()
});

export default function AddCareEventModal({
  isOpen,
  onClose,
  careRecipientId,
  defaultEventType = "medication",
  selectedDate
}: AddCareEventModalProps) {
  const [eventType, setEventType] = useState<EventType>(defaultEventType);

  const form = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      type: defaultEventType,
      name: "",
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      time: format(new Date(), "HH:mm"),
      notes: "",
      reminder: true,
      careRecipientId: careRecipientId ? parseInt(careRecipientId) : 0
    }
  });

  const addEvent = useMutation({
    mutationFn: async (data: z.infer<typeof eventSchema>) => {
      let endpoint = "";
      
      switch (data.type) {
        case "medication":
          endpoint = "/api/medication-logs";
          break;
        case "meal":
          endpoint = "/api/meals";
          break;
        case "bowel":
          endpoint = "/api/bowel-movements";
          break;
        case "appointment":
          endpoint = "/api/appointments";
          break;
      }
      
      const response = await apiRequest("POST", endpoint, data);
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
        case "appointment":
          queryClient.invalidateQueries({ 
            queryKey: ['/api/appointments', careRecipientId] 
          });
          break;
      }
      
      // Reset form and close modal
      form.reset();
      onClose();
    }
  });

  const onSubmit = (data: z.infer<typeof eventSchema>) => {
    if (!careRecipientId) return;
    
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
                  <Thermometer className="h-5 w-5 mb-1" />
                  <span className="text-xs">Bowel</span>
                </Button>
              </div>
            </div>
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={
                        eventType === "medication" ? "Blood Pressure Medicine" : 
                        eventType === "meal" ? "Breakfast" : 
                        eventType === "bowel" ? "Bowel Movement" :
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
