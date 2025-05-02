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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronsUpDown, AlertCircle, Trash2, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { debounce } from "@/lib/utils";

interface AddMedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  careRecipientId: string | null;
}

// Define the schedule item schema
const scheduleItemSchema = z.object({
  time: z.string().min(1, "Time is required"),
  daysOfWeek: z.array(z.number().min(0).max(6)),
  quantity: z.string().min(1, "Quantity is required"),
  withFood: z.boolean().default(false),
  active: z.boolean().default(true),
  reminderEnabled: z.boolean().default(true),
  // Add asNeeded flag for "as needed" medications
  asNeeded: z.boolean().default(false),
  // Add specific days selection (for medications taken on specific calendar days)
  specificDays: z.array(z.string()).default([]),
  // Add tapering dose schedule support
  isTapering: z.boolean().default(false),
  taperingSchedule: z.array(
    z.object({
      startDate: z.string(),
      endDate: z.string(),
      quantity: z.string(),
    })
  ).default([]),
});

// Main medication schema
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
  // Add a schedules array to the medication schema
  schedules: z.array(scheduleItemSchema).default([]),
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

// Helper function to get quantity options based on medication form
const getQuantityOptionsForMedication = (icon: string | null) => {
  if (!icon) return quantityOptionsByForm.default;
  
  // Return the appropriate options or default if not found
  return quantityOptionsByForm[icon as keyof typeof quantityOptionsByForm] 
    || quantityOptionsByForm.default;
};

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
  const [showCustomTime, setShowCustomTime] = useState<boolean>(false);
  const [useSpecificDays, setUseSpecificDays] = useState<boolean>(false);

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
      schedules: [
        {
          time: "08:00:00", // Default to 8 AM
          daysOfWeek: [1, 2, 3, 4, 5, 6, 0], // All days by default
          quantity: "1 tablet",
          withFood: false,
          active: true,
          reminderEnabled: true,
          asNeeded: false,
          specificDays: [],
          isTapering: false,
          taperingSchedule: [],
        }
      ]
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
                    <FormLabel>Icon Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select icon type" />
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
                    <FormDescription className="text-xs">
                      Select the type of medication for display purposes. This helps identify the medication format in the list.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="iconColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Color</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select display color" />
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
                    <FormDescription className="text-xs">
                      This color is used for organization purposes only and helps you visually distinguish between medications in the list.
                    </FormDescription>
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
            
            {/* Medication Schedule Section */}
            <div className="border p-4 rounded-md mt-6">
              <h3 className="text-lg font-medium mb-4">Medication Schedule</h3>
              
              {/* First Schedule Item - We'll just support one schedule in the Add form for simplicity */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="schedules.0.time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time of Day</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
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
                  name="schedules.0.quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dose Quantity</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select quantity" />
                        </SelectTrigger>
                        <SelectContent>
                          {getQuantityOptionsForMedication(form.watch('icon')).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* As Needed Switch */}
                <FormField
                  control={form.control}
                  name="schedules.0.asNeeded"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Take As Needed (PRN)</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          This medication is only taken when needed, not on a regular schedule
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                {/* Show schedule options if not "as needed" */}
                {!form.watch('schedules.0.asNeeded') && (
                  <div className="space-y-4">
                    {/* Specific Days vs Days of Week Toggle */}
                    <div className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Schedule Type</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Choose between days of the week or specific calendar dates
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">Days of Week</span>
                        <Switch
                          checked={useSpecificDays}
                          onCheckedChange={(checked) => {
                            setUseSpecificDays(checked);
                            if (checked) {
                              // Switch to specific days
                              const today = new Date();
                              const todayStr = today.toISOString().split('T')[0];
                              form.setValue('schedules.0.specificDays', [todayStr]);
                            } else {
                              // Switch back to days of week
                              form.setValue('schedules.0.daysOfWeek', [1, 2, 3, 4, 5, 6, 0]);
                            }
                          }}
                        />
                        <span className="text-sm text-muted-foreground">Specific Dates</span>
                      </div>
                    </div>
                    
                    {/* Show appropriate schedule field based on the selection */}
                    {!useSpecificDays ? (
                      <FormField
                        control={form.control}
                        name="schedules.0.daysOfWeek"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Days of Week</FormLabel>
                            <div className="flex flex-wrap gap-2">
                              {daysOfWeekOptions.map((day) => (
                                <div
                                  key={day.value}
                                  className="flex items-center space-x-2"
                                >
                                  <Checkbox
                                    id={`day-${day.value}`}
                                    checked={field.value.includes(day.value)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        field.onChange([...field.value, day.value].sort());
                                      } else {
                                        field.onChange(
                                          field.value.filter((value: number) => value !== day.value)
                                        );
                                      }
                                    }}
                                  />
                                  <label
                                    htmlFor={`day-${day.value}`}
                                    className="text-sm font-medium leading-none cursor-pointer"
                                  >
                                    {day.label}
                                  </label>
                                </div>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <FormField
                        control={form.control}
                        name="schedules.0.specificDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Specific Calendar Dates</FormLabel>
                            <div className="space-y-3">
                              {field.value.map((date: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Input
                                    type="date"
                                    value={date}
                                    onChange={(e) => {
                                      const newDates = [...field.value];
                                      newDates[idx] = e.target.value;
                                      field.onChange(newDates);
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      const newDates = [...field.value];
                                      newDates.splice(idx, 1);
                                      field.onChange(newDates);
                                    }}
                                    disabled={field.value.length <= 1}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => {
                                  // Add a date 1 day after the last one
                                  const lastDate = new Date(field.value[field.value.length - 1]);
                                  lastDate.setDate(lastDate.getDate() + 1);
                                  const newDate = lastDate.toISOString().split('T')[0];
                                  field.onChange([...field.value, newDate]);
                                }}
                              >
                                <PlusCircle className="h-4 w-4 mr-2" />
                                Add Date
                              </Button>
                            </div>
                            <FormDescription className="text-xs mt-2">
                              Add specific calendar dates on which this medication should be taken
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                )}
                
                {/* With Food Option */}
                <FormField
                  control={form.control}
                  name="schedules.0.withFood"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Take With Food</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          This medication should be taken with food
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
                
                {/* Tapering Dose option */}
                <FormField
                  control={form.control}
                  name="schedules.0.isTapering"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Tapering Dose Schedule</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Create a schedule to gradually change dose amounts over time (for medications like steroids or pain medications)
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
                
                {/* Show tapering schedule if enabled */}
                {form.watch('schedules.0.isTapering') && (
                  <FormField
                    control={form.control}
                    name="schedules.0.taperingSchedule"
                    render={({ field }) => (
                      <FormItem className="space-y-2 border p-4 rounded-md bg-slate-50">
                        <div className="space-y-2 mb-3">
                          <h4 className="text-sm font-medium">Tapering Dose Schedule</h4>
                          <p className="text-xs text-muted-foreground">
                            Create different dose amounts for specific date ranges. This is useful for medications 
                            that need to be gradually increased or decreased over time.
                          </p>
                        </div>
                       
                        {(!field.value || field.value.length === 0) && (
                          <div className="text-center py-4">
                            <p className="text-sm text-muted-foreground mb-3">No tapering steps defined yet.</p>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                // Get start date (today)
                                const startDate = new Date();
                                
                                // Get end date 7 days from now
                                const endDate = new Date();
                                endDate.setDate(endDate.getDate() + 7);
                                
                                // Create a new tapering item
                                const newSchedule = [
                                  {
                                    startDate: startDate.toISOString().split('T')[0],
                                    endDate: endDate.toISOString().split('T')[0],
                                    quantity: form.watch('schedules.0.quantity'),
                                  }
                                ];
                                
                                field.onChange(newSchedule);
                              }}
                            >
                              Add First Tapering Step
                            </Button>
                          </div>
                        )}
                        
                        {field.value && field.value.length > 0 && (
                          <div className="space-y-4 mt-3">
                            {field.value.map((step: any, stepIndex: number) => (
                              <div key={stepIndex} className="border p-4 rounded-md bg-white">
                                <div className="flex justify-between mb-3">
                                  <h5 className="text-base font-medium">Tapering Step {stepIndex + 1}</h5>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => {
                                      const newSchedule = [...field.value];
                                      newSchedule.splice(stepIndex, 1);
                                      field.onChange(newSchedule);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-sm font-medium mb-1 block">Start Date</label>
                                    <Input 
                                      type="date" 
                                      value={step.startDate}
                                      onChange={(e) => {
                                        const newSchedule = [...field.value];
                                        newSchedule[stepIndex].startDate = e.target.value;
                                        field.onChange(newSchedule);
                                      }}
                                    />
                                  </div>
                                  
                                  <div>
                                    <label className="text-sm font-medium mb-1 block">End Date</label>
                                    <Input 
                                      type="date" 
                                      value={step.endDate}
                                      onChange={(e) => {
                                        const newSchedule = [...field.value];
                                        newSchedule[stepIndex].endDate = e.target.value;
                                        field.onChange(newSchedule);
                                      }}
                                    />
                                  </div>
                                  
                                  <div className="sm:col-span-2">
                                    <label className="text-sm font-medium mb-1 block">Dose Amount</label>
                                    <div className="flex gap-2">
                                      <Input 
                                        value={step.quantity}
                                        onChange={(e) => {
                                          const newSchedule = [...field.value];
                                          newSchedule[stepIndex].quantity = e.target.value;
                                          field.onChange(newSchedule);
                                        }}
                                        placeholder="e.g., 1/2 tablet, 20mg, etc."
                                        className="flex-1"
                                      />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Specify the exact dose amount for this date range
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full mt-2"
                              onClick={() => {
                                // Get the end date of the last step
                                const lastStep = field.value[field.value.length - 1];
                                const lastEndDate = new Date(lastStep.endDate);
                                
                                // New start date is the day after the last end date
                                const startDate = new Date(lastEndDate);
                                startDate.setDate(startDate.getDate() + 1);
                                
                                // End date is 7 days after start
                                const endDate = new Date(startDate);
                                endDate.setDate(endDate.getDate() + 7);
                                
                                // Determine next quantity (decrease by 25% if possible)
                                let nextQuantity = lastStep.quantity;
                                if (lastStep.quantity.includes("tablet")) {
                                  // For tablets, try to reduce by 1/2 or 1 tablet
                                  const match = lastStep.quantity.match(/^(\d+(?:\/\d+)?)(.*)$/);
                                  if (match) {
                                    const amount = match[1];
                                    const unit = match[2];
                                    if (amount === "1") {
                                      nextQuantity = "1/2" + unit;
                                    } else if (amount === "2") {
                                      nextQuantity = "1" + unit;
                                    } else if (amount === "3") {
                                      nextQuantity = "2" + unit;
                                    }
                                  }
                                }
                                
                                // Add new tapering step
                                field.onChange([
                                  ...field.value,
                                  {
                                    startDate: startDate.toISOString().split('T')[0],
                                    endDate: endDate.toISOString().split('T')[0],
                                    quantity: nextQuantity,
                                  }
                                ]);
                              }}
                            >
                              <PlusCircle className="h-4 w-4 mr-2" />
                              Add Next Tapering Step
                            </Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
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