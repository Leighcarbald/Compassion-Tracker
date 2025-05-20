import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Home, Moon, Sun, CalendarDays, Clock, AlignLeft } from "lucide-react";
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

interface AddSleepModalProps {
  isOpen: boolean;
  onClose: () => void;
  careRecipientId: string | null;
}

const formSchema = z.object({
  quality: z.string().optional(),
  bedDate: z.string().min(1, { message: "Bed date is required" }),
  bedTime: z.string().min(1, { message: "Bed time is required" }),
  wakeDate: z.string().optional(),
  wakeTime: z.string().optional(),
  notes: z.string().optional(),
  careRecipientId: z.union([z.string(), z.number()]).transform(val => 
    typeof val === 'string' ? parseInt(val) : val
  ),
});

export default function AddSleepModal({
  isOpen,
  onClose,
  careRecipientId,
}: AddSleepModalProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const today = new Date();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quality: "Good",
      bedDate: format(today, "yyyy-MM-dd"),
      bedTime: format(today, "HH:mm"),
      wakeDate: format(today, "yyyy-MM-dd"),
      wakeTime: "",
      notes: "",
      careRecipientId: careRecipientId ? parseInt(careRecipientId) : 0,
    },
  });

  // Update the careRecipientId when it changes
  if (careRecipientId && parseInt(careRecipientId) !== form.getValues().careRecipientId) {
    form.setValue("careRecipientId", parseInt(careRecipientId));
  }

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Convert the bed date and time fields to a combined ISO date string
      const bedDateTime = new Date(`${data.bedDate}T${data.bedTime}`);
      
      // For wake up time, only create it if both date and time are provided
      let wakeDateTime = null;
      if (data.wakeDate && data.wakeTime && data.wakeTime.trim() !== '') {
        wakeDateTime = new Date(`${data.wakeDate}T${data.wakeTime}`);
      }
      
      // Convert dates to ISO strings since that's what the server expects
      const postData = {
        quality: data.quality,
        notes: data.notes || "",
        startTime: bedDateTime.toISOString(),
        endTime: wakeDateTime ? wakeDateTime.toISOString() : null,
        careRecipientId: data.careRecipientId
      };
      
      console.log("Submitting sleep data:", postData);
      const response = await apiRequest("POST", "/api/sleep", postData);
      const responseData = await response.json();
      console.log("Server response:", responseData);
      return responseData;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Sleep record has been added",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sleep', careRecipientId] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today', careRecipientId] });
      
      const today = new Date();
      form.reset({
        quality: "Good",
        bedDate: format(today, "yyyy-MM-dd"),
        bedTime: format(today, "HH:mm"),
        wakeDate: format(today, "yyyy-MM-dd"),
        wakeTime: "",
        notes: "",
        careRecipientId: careRecipientId ? parseInt(careRecipientId) : 0,
      });
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
            <Moon className="mr-2 h-5 w-5 text-primary" />
            Add Sleep Record
          </DialogTitle>
          <DialogDescription>
            Record a new sleep period
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="quality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sleep Quality</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sleep quality" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Excellent">Excellent</SelectItem>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Fair">Fair</SelectItem>
                      <SelectItem value="Poor">Poor</SelectItem>
                      <SelectItem value="Very Poor">Very Poor</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center">
                <Moon className="h-4 w-4 mr-1 text-indigo-500" /> Bed Time
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bedDate"
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
                  name="bedTime"
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
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center">
                <Sun className="h-4 w-4 mr-1 text-amber-500" /> Wake Up Time (Optional)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="wakeDate"
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
                  name="wakeTime"
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
                      placeholder="Add any additional notes about the sleep quality, interruptions, etc..."
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