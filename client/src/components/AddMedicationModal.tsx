import { useState, useEffect, useCallback } from "react";
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
  FormDescription,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronsUpDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { debounce } from "@/lib/utils";

interface AddMedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  careRecipientId: string | null;
}

const medicationSchema = z.object({
  name: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  instructions: z.string().optional(),
  icon: z.string().default("pills"),
  iconColor: z.string().default("#4F46E5"),
  careRecipientId: z.number().positive(),
  currentQuantity: z.number().min(0, "Quantity must be a positive number"),
  reorderThreshold: z.number().min(1, "Threshold must be at least 1"),
  daysToReorder: z.number().min(1, "Days to reorder must be at least 1").max(30, "Days to reorder must be at most 30"),
  originalQuantity: z.number().min(0, "Original quantity must be a positive number"),
  refillsRemaining: z.number().min(0, "Refills remaining must be a positive number"),
  doctorId: z.number().optional().nullable(),
  prescriptionNumber: z.string().optional().nullable(),
  expirationDate: z.string().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  lastRefillDate: z.date().optional().nullable(),
});

const iconOptions = [
  { value: "pills", label: "Pills" },
  { value: "capsule", label: "Capsule" },
  { value: "syringe", label: "Syringe" },
  { value: "droplet", label: "Liquid" },
  { value: "bandage", label: "Bandage" },
  { value: "stethoscope", label: "Other" },
];

const colorOptions = [
  { value: "#4F46E5", label: "Blue" },
  { value: "#10B981", label: "Green" },
  { value: "#F97316", label: "Orange" },
  { value: "#EF4444", label: "Red" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#F59E0B", label: "Yellow" },
];

export default function AddMedicationModal({
  isOpen,
  onClose,
  careRecipientId,
}: AddMedicationModalProps) {
  const { toast } = useToast();
  const [daysToReorder, setDaysToReorder] = useState(7);
  const [medNameInput, setMedNameInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [showInteractions, setShowInteractions] = useState(false);

  const form = useForm({
    resolver: zodResolver(medicationSchema),
    defaultValues: {
      name: "",
      dosage: "",
      instructions: "",
      icon: "pills",
      iconColor: "#4F46E5",
      careRecipientId: careRecipientId ? parseInt(careRecipientId) : 0,
      currentQuantity: 0,
      reorderThreshold: 5,
      daysToReorder: 7,
      originalQuantity: 0,
      refillsRemaining: 0,
      prescriptionNumber: "",
      expirationDate: "",
    }
  });
  
  // Fetch current medications for interaction checking
  const { data: medications } = useQuery({
    queryKey: ['/api/medications', careRecipientId],
    queryFn: async () => {
      if (!careRecipientId) return [];
      const res = await apiRequest('GET', `/api/medications?careRecipientId=${careRecipientId}`);
      return await res.json();
    },
    enabled: !!careRecipientId && isOpen,
  });
  
  // Get medication name suggestions as user types
  const fetchMedicationSuggestions = useCallback(async (partialName: string) => {
    if (!partialName || partialName.length < 2) {
      setSuggestions([]);
      return;
    }
    
    setIsLoadingSuggestions(true);
    try {
      const response = await apiRequest(
        'GET',
        `/api/medications/suggestions?name=${encodeURIComponent(partialName)}`
      );
      const data = await response.json();
      setSuggestions(data);
    } catch (error) {
      console.error('Failed to fetch medication suggestions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch medication suggestions.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [toast]);
  
  // Create a debounced version of the fetch function
  const debouncedFetchSuggestions = useCallback(
    debounce((name: string) => fetchMedicationSuggestions(name), 500),
    [fetchMedicationSuggestions]
  );
  
  // Handle changes to the medication name input
  const handleMedNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMedNameInput(value);
    form.setValue('name', value);
    
    if (value.length >= 2) {
      debouncedFetchSuggestions(value);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };
  
  // Function to check for drug interactions
  const checkDrugInteractions = useCallback(async (medName: string) => {
    if (!medications || !medName || medName.length < 2) return;
    
    console.log('Checking drug interactions for:', medName);
    setShowInteractions(false);
    
    // Get existing medication names from the medications array
    const existingMedNames = medications.map((med: any) => med.name);
    
    // Only include non-empty medication names
    const filteredMedNames = existingMedNames.filter(name => name && name.trim().length > 0);
    
    // Add the new medication name the user is entering
    filteredMedNames.push(medName);
    
    console.log('Checking interactions between:', filteredMedNames);
    
    try {
      const response = await apiRequest(
        'POST',
        '/api/medications/interactions',
        { medicationNames: filteredMedNames }
      );
      
      if (!response.ok) {
        console.error('Interaction check API returned error:', response.status);
        return;
      }
      
      const data = await response.json();
      console.log('Interaction check response:', data);
      
      if (data.success && data.interactions && data.interactions.length > 0) {
        setInteractions(data.interactions);
        setShowInteractions(true);
      } else {
        setInteractions([]);
        setShowInteractions(false);
      }
    } catch (error) {
      console.error('Failed to check drug interactions:', error);
      setInteractions([]);
      setShowInteractions(false);
    }
  }, [medications]);

  const createMedication = useMutation({
    mutationFn: async (data: z.infer<typeof medicationSchema>) => {
      console.log("Submitting medication data:", data);
      try {
        const response = await apiRequest("POST", "/api/medications", data);
        if (!response.ok) {
          const errorText = await response.text();
          console.error("API error response:", errorText);
          throw new Error(`API error: ${response.status} ${errorText}`);
        }
        return response.json();
      } catch (err) {
        console.error("Error in createMedication mutation:", err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log("Medication added successfully:", data);
      // Invalidate both medication list and care stats (for dashboard)
      queryClient.invalidateQueries({ queryKey: ['/api/medications', careRecipientId] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today', careRecipientId] });
      toast({
        title: "Success",
        description: "Medication added successfully",
        variant: "default",
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      console.error("Mutation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add medication",
        variant: "destructive",
      });
    }
  });

  // Check if we have serious drug interactions
  const hasHighSeverityInteractions = interactions.some(
    interaction => interaction.severity === 'high'
  );

  const onSubmit = (data: z.infer<typeof medicationSchema>) => {
    if (!careRecipientId) return;
    
    // Make sure careRecipientId is a number
    const formattedData = {
      ...data,
      careRecipientId: parseInt(careRecipientId),
      // Set default null values for optional fields
      doctorId: data.doctorId || null,
      prescriptionNumber: data.prescriptionNumber || null,
      expirationDate: data.expirationDate || null,
      lastRefillDate: null,
      // Handle date fields
      createdAt: undefined,  // Let the server set these
      updatedAt: undefined,
      instructions: data.instructions || ""
    };
    
    // Check for drug interactions one last time before submitting
    if (hasHighSeverityInteractions) {
      // Warn the user about high-severity interactions
      toast({
        title: "Warning: Potential Serious Drug Interactions",
        description: "This medication may have serious interactions with other medications. Please confirm with a healthcare provider before adding.",
        variant: "destructive",
        duration: 10000, // Show warning longer
      });
      // We still proceed with adding the medication, but with a warning
    }
    
    console.log("Adding medication:", formattedData);
    createMedication.mutate(formattedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Medication</DialogTitle>
          <DialogDescription>
            Enter the details of the medication to add it to your list.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Medication Name</FormLabel>
                  <Popover open={showSuggestions && suggestions.length > 0} onOpenChange={setShowSuggestions}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            placeholder="e.g., Lisinopril" 
                            value={medNameInput}
                            onChange={handleMedNameChange}
                            onBlur={() => {
                              field.onBlur();
                              // Check for drug interactions when user finishes typing
                              if (medNameInput.length > 2) {
                                checkDrugInteractions(medNameInput);
                              }
                              // Close suggestions after a delay to allow for selection
                              setTimeout(() => setShowSuggestions(false), 200);
                            }}
                          />
                          {isLoadingSuggestions && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                            </div>
                          )}
                        </div>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[300px] max-h-[200px] overflow-y-auto" align="start">
                      <Command>
                        <CommandInput placeholder="Search medication..." />
                        <CommandEmpty>No medication found.</CommandEmpty>
                        <CommandGroup>
                          {suggestions.map((suggestion) => (
                            <CommandItem
                              key={suggestion}
                              value={suggestion}
                              onSelect={(value) => {
                                setMedNameInput(value);
                                form.setValue('name', value);
                                setShowSuggestions(false);
                                checkDrugInteractions(value);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  medNameInput === suggestion ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {suggestion}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {showInteractions && interactions.length > 0 && (
                    <div className="mt-2">
                      {interactions.map((interaction, index) => (
                        <Alert key={index} variant={interaction.severity === 'high' ? 'destructive' : 'default'} className="mb-2">
                          <AlertCircle className="h-4 w-4 mr-2" />
                          <AlertTitle className="text-sm font-semibold">
                            Interaction with {interaction.drug1 === medNameInput ? interaction.drug2 : interaction.drug1}
                          </AlertTitle>
                          <AlertDescription className="text-xs mt-1">
                            {interaction.description}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                  <FormDescription className="text-xs">
                    Start typing to see suggestions from our medication database.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="dosage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dosage</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 10mg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="e.g., Take once daily with food" 
                      rows={2} 
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
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select icon" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {iconOptions.map((icon) => (
                          <SelectItem key={icon.value} value={icon.value}>
                            {icon.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="iconColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select color" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {colorOptions.map((color) => (
                          <SelectItem 
                            key={color.value} 
                            value={color.value}
                            className="flex items-center gap-2"
                          >
                            <div 
                              className="w-4 h-4 rounded-full" 
                              style={{ backgroundColor: color.value }}
                            />
                            {color.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currentQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="originalQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Original Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reorderThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder Threshold</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="refillsRemaining"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Refills Remaining</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="daysToReorder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Days to Reorder in Advance: {field.value}</FormLabel>
                  <FormControl>
                    <Slider
                      min={1}
                      max={30}
                      step={1}
                      value={[field.value]}
                      onValueChange={(value) => {
                        field.onChange(value[0]);
                        setDaysToReorder(value[0]);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-gray-500 mt-1">
                    Alerts will be shown {field.value} days before you'll run out of medication.
                  </p>
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="prescriptionNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prescription # (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="expirationDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration Date (Optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
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
                disabled={createMedication.isPending}
              >
                {createMedication.isPending ? "Adding..." : "Add Medication"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}