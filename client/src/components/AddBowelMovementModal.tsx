import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
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
import { CharacterCount } from "@/components/ui/character-count";
import { useLocation } from "wouter";

interface AddBowelMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  careRecipientId: string | null;
  onSuccess?: () => void;
}

const formSchema = z.object({
  type: z.string().min(1, { message: "Please select a type" }),
  date: z.string().min(1, { message: "Date is required" }),
  time: z.string().min(1, { message: "Time is required" }),
  notes: z.string().optional(),
  careRecipientId: z.union([z.string(), z.number()]).transform(val => 
    typeof val === 'string' ? parseInt(val) : val
  ),
});

export default function AddBowelMovementModal({
  isOpen,
  onClose,
  careRecipientId,
  onSuccess,
}: AddBowelMovementModalProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "Regular",
      date: format(new Date(), "yyyy-MM-dd"),
      time: format(new Date(), "HH:mm"),
      notes: "",
      careRecipientId: careRecipientId ? parseInt(careRecipientId) : 0,
    },
  });
  
  // Watch the notes field for character count
  const notesValue = useWatch({
    control: form.control,
    name: "notes",
    defaultValue: ""
  });

  // Update the careRecipientId when it changes
  if (careRecipientId && parseInt(careRecipientId) !== form.getValues().careRecipientId) {
    form.setValue("careRecipientId", parseInt(careRecipientId));
  }

  const createMutation = useMutation({
    mutationFn: async (formData: any) => {
      // Convert the date and time fields to a combined ISO date string
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      
      const postData = {
        type: formData.type,
        notes: formData.notes || "",
        occuredAt: dateTime.toISOString(),
        careRecipientId: formData.careRecipientId
      };
      
      console.log("Submitting bowel movement data:", postData);
      const response = await apiRequest("POST", "/api/bowel-movements", postData);
      const responseData = await response.json(); // Parse the JSON response to get the created record
      console.log("Server response:", responseData);
      return responseData;
    },
    onSuccess: (newBowelMovement) => {
      // First invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/bowel-movements', careRecipientId] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today', careRecipientId] });
      
      // Show success toast with more details
      toast({
        title: "Success",
        description: `${newBowelMovement.type} bowel movement record has been added`,
        variant: "default",
      });
      
      // Reset form
      form.reset({
        type: "Regular",
        date: format(new Date(), "yyyy-MM-dd"),
        time: format(new Date(), "HH:mm"),
        notes: "",
        careRecipientId: careRecipientId ? parseInt(careRecipientId) : 0,
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
        description: `Failed to add record: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center">
            <Toilet className="mr-2 h-5 w-5 text-primary" />
            Add Bowel Movement
          </DialogTitle>
          <DialogDescription>
            {createMutation.isPending
              ? "Adding bowel movement record..."
              : "Record a new bowel movement"}
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
                    defaultValue={field.value}
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
                      className="resize-none overflow-y-auto"
                      maxLength={500}
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <CharacterCount value={notesValue || ""} maxLength={500} />
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
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}