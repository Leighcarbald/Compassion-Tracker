import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Utensils, CalendarDays, Clock, AlignLeft, Save } from "lucide-react";
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
import { type Meal } from "@shared/schema";

interface EditMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  meal: Meal | null;
}

const formSchema = z.object({
  food: z.string().min(1, { message: "Food is required" }),
  type: z.string().min(1, { message: "Please select a type" }),
  date: z.string().min(1, { message: "Date is required" }),
  time: z.string().min(1, { message: "Time is required" }),
  notes: z.string().optional(),
  careRecipientId: z.union([z.string(), z.number()]).transform(val => 
    typeof val === 'string' ? parseInt(val) : val
  ),
});

export default function EditMealModal({
  isOpen,
  onClose,
  meal,
}: EditMealModalProps) {
  const { toast } = useToast();
  
  // Convert meal data to form format
  const getDefaultValues = (mealData: Meal | null) => {
    if (!mealData) return null;
    
    const consumedAt = new Date(mealData.consumedAt);
    
    return {
      food: mealData.food,
      type: mealData.type,
      date: format(consumedAt, "yyyy-MM-dd"),
      time: format(consumedAt, "HH:mm"),
      notes: mealData.notes || "",
      careRecipientId: mealData.careRecipientId,
    };
  };
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: meal ? getDefaultValues(meal) : undefined,
  });
  
  // Update form values when meal changes
  useEffect(() => {
    if (meal) {
      const defaultValues = getDefaultValues(meal);
      if (defaultValues) {
        Object.entries(defaultValues).forEach(([key, value]) => {
          form.setValue(key as any, value);
        });
      }
    }
  }, [meal, form]);
  
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!meal) throw new Error("No meal to update");
      
      // Convert the date and time fields to a combined ISO date string
      const dateTime = new Date(`${data.date}T${data.time}`);
      
      const updateData = {
        type: data.type,
        food: data.food,
        notes: data.notes || "",
        consumedAt: dateTime.toISOString(),
        careRecipientId: data.careRecipientId
      };
      
      console.log(`Updating meal ${meal.id} with data:`, updateData);
      return await apiRequest("PATCH", `/api/meals/${meal.id}`, updateData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Meal record has been updated",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meals', meal?.careRecipientId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today', meal?.careRecipientId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/date', meal?.careRecipientId.toString()] });
      form.reset();
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center">
            <Utensils className="mr-2 h-5 w-5 text-primary" />
            Edit Meal
          </DialogTitle>
          <DialogDescription>
            Update meal details
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="food"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Food Item(s)</FormLabel>
                  <FormControl>
                    <Input placeholder="What was eaten?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meal Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select meal type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Breakfast">Breakfast</SelectItem>
                      <SelectItem value="Lunch">Lunch</SelectItem>
                      <SelectItem value="Dinner">Dinner</SelectItem>
                      <SelectItem value="Snack">Snack</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
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
            
            <DialogFooter className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                className="flex items-center gap-1"
              >
                {updateMutation.isPending ? (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}