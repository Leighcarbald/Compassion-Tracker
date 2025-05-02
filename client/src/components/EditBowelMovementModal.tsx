import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Home, Toilet, CalendarDays, Clock, AlignLeft } from "lucide-react";
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
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { BowelMovement } from "@shared/schema";

interface EditBowelMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: BowelMovement | null;
  onSuccess?: () => void;
}

const formSchema = z.object({
  type: z.string().min(1, { message: "Please select a type" }),
  date: z.string().min(1, { message: "Date is required" }),
  time: z.string().min(1, { message: "Time is required" }),
  notes: z.string().optional(),
  id: z.number().positive(),
  careRecipientId: z.number().positive()
});

export default function EditBowelMovementModal({
  isOpen,
  onClose,
  movement,
  onSuccess,
}: EditBowelMovementModalProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "",
      date: format(new Date(), "yyyy-MM-dd"),
      time: format(new Date(), "HH:mm"),
      notes: "",
      id: 0,
      careRecipientId: 0,
    },
  });

  // Update form values when the movement changes
  useEffect(() => {
    if (movement) {
      const date = format(parseISO(movement.occuredAt.toString()), "yyyy-MM-dd");
      const time = format(parseISO(movement.occuredAt.toString()), "HH:mm");
      
      form.reset({
        type: movement.type || "Regular",
        date: date,
        time: time,
        notes: movement.notes || "",
        id: movement.id,
        careRecipientId: movement.careRecipientId,
      });
    }
  }, [movement, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // Convert the date and time fields to a combined ISO date string
      const dateTime = new Date(`${data.date}T${data.time}`);
      
      const updateData = {
        type: data.type,
        notes: data.notes || "",
        occuredAt: dateTime.toISOString(),
      };
      
      console.log("Updating bowel movement data:", updateData);
      const response = await apiRequest("PATCH", `/api/bowel-movements/${data.id}`, updateData);
      return response.json(); // Parse the JSON response to get the updated record
    },
    onSuccess: (updatedMovement) => {
      // First invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/bowel-movements', movement?.careRecipientId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today', movement?.careRecipientId.toString()] });
      
      // Show success toast with more details
      toast({
        title: "Success",
        description: `${updatedMovement.type} bowel movement record has been updated`,
        variant: "default",
      });
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        console.log("Calling onSuccess callback to refresh data");
        onSuccess();
      }
      
      // Close the modal after all operations are complete
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update record: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    updateMutation.mutate(data);
  };

  // Don't render if no movement is provided
  if (!movement && isOpen) {
    onClose();
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center">
            <Toilet className="mr-2 h-5 w-5 text-primary" />
            Edit Bowel Movement
          </DialogTitle>
          <DialogDescription>
            {updateMutation.isPending
              ? "Updating bowel movement record..."
              : "Update bowel movement record"}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Regular">Regular</SelectItem>
                      <SelectItem value="Hard">Hard</SelectItem>
                      <SelectItem value="Soft">Soft</SelectItem>
                      <SelectItem value="Loose">Loose</SelectItem>
                      <SelectItem value="Diarrhea">Diarrhea</SelectItem>
                      <SelectItem value="Constipation">Constipation</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <FormLabel className="flex items-center">
                      <CalendarDays className="h-4 w-4 mr-1" /> Date
                    </FormLabel>
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
                    <FormLabel className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" /> Time
                    </FormLabel>
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
                  <FormLabel className="flex items-center">
                    <AlignLeft className="h-4 w-4 mr-1" /> Notes (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional notes here..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="flex justify-between pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/")}
                className="flex items-center gap-1"
              >
                <Home className="h-4 w-4" />
                Home
              </Button>
              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}