import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { Droplets, Syringe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CharacterCount } from "@/components/ui/character-count";

interface EditGlucoseInsulinModalProps {
  type: "glucose" | "insulin";
  isOpen: boolean;
  onClose: () => void;
  data: any; // Either Glucose or Insulin record
  onSuccess?: () => void;
}

export default function EditGlucoseInsulinModal({
  type,
  isOpen,
  onClose,
  data,
  onSuccess,
}: EditGlucoseInsulinModalProps) {
  // Common fields
  const [readingDate, setReadingDate] = useState<Date>(new Date());
  const [readingTime, setReadingTime] = useState(format(new Date(), "HH:mm"));
  
  // Glucose fields
  const [glucoseLevel, setGlucoseLevel] = useState("");
  const [readingType, setReadingType] = useState("fasting");
  const [glucoseNotes, setGlucoseNotes] = useState("");
  
  // Insulin fields
  const [insulinUnits, setInsulinUnits] = useState("");
  const [insulinType, setInsulinType] = useState("rapid-acting");
  const [injectionSite, setInjectionSite] = useState("");
  const [insulinNotes, setInsulinNotes] = useState("");
  
  const { toast } = useToast();

  useEffect(() => {
    if (data && isOpen) {
      if (type === "glucose") {
        setGlucoseLevel(data.level.toString());
        setReadingType(data.readingType);
        setGlucoseNotes(data.notes || "");
        
        // Set date and time from timeOfReading
        const date = new Date(data.timeOfReading);
        setReadingDate(date);
        setReadingTime(format(date, "HH:mm"));
      } else if (type === "insulin") {
        setInsulinUnits(data.units.toString());
        setInsulinType(data.insulinType);
        setInjectionSite(data.site || "");
        setInsulinNotes(data.notes || "");
        
        // Set date and time from timeAdministered
        const date = new Date(data.timeAdministered);
        setReadingDate(date);
        setReadingTime(format(date, "HH:mm"));
      }
    }
  }, [data, isOpen, type]);

  const updateGlucoseMutation = useMutation({
    mutationFn: async (updateData: {
      level: number;
      readingType: string;
      timeOfReading: Date;
      notes: string;
    }) => {
      const response = await fetch(`/api/glucose/${data.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) {
        throw new Error("Failed to update glucose reading");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Glucose reading updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/glucose", data.careRecipientId] });
      // Also invalidate today's stats for dashboard updates
      queryClient.invalidateQueries({ queryKey: ["/api/care-stats/today", data.careRecipientId] });
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateInsulinMutation = useMutation({
    mutationFn: async (updateData: {
      units: number;
      insulinType: string;
      timeAdministered: Date;
      site?: string;
      notes?: string;
    }) => {
      const response = await fetch(`/api/insulin/${data.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) {
        throw new Error("Failed to update insulin record");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Insulin record updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/insulin", data.careRecipientId] });
      // Also invalidate today's stats for dashboard updates
      queryClient.invalidateQueries({ queryKey: ["/api/care-stats/today", data.careRecipientId] });
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteGlucoseMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/glucose/${data.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete glucose reading");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Glucose reading deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/glucose", data.careRecipientId] });
      // Also invalidate today's stats for dashboard updates
      queryClient.invalidateQueries({ queryKey: ["/api/care-stats/today", data.careRecipientId] });
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteInsulinMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/insulin/${data.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete insulin record");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Insulin record deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/insulin", data.careRecipientId] });
      // Also invalidate today's stats for dashboard updates
      queryClient.invalidateQueries({ queryKey: ["/api/care-stats/today", data.careRecipientId] });
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitGlucose = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate the form
    if (!glucoseLevel) {
      toast({
        title: "Error",
        description: "Glucose level is required",
        variant: "destructive",
      });
      return;
    }
    
    // Create the timestamp from the date and time
    const timeOfReading = new Date(readingDate);
    const [hours, minutes] = readingTime.split(':').map(Number);
    timeOfReading.setHours(hours, minutes);
    
    // Submit the form data
    updateGlucoseMutation.mutate({
      level: Number(glucoseLevel),
      timeOfReading,
      readingType,
      notes: glucoseNotes,
    });
  };

  const handleSubmitInsulin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate the form
    if (!insulinUnits) {
      toast({
        title: "Error",
        description: "Insulin units are required",
        variant: "destructive",
      });
      return;
    }
    
    // Create the timestamp from the date and time
    const timeAdministered = new Date(readingDate);
    const [hours, minutes] = readingTime.split(':').map(Number);
    timeAdministered.setHours(hours, minutes);
    
    // Submit the form data
    updateInsulinMutation.mutate({
      units: Number(insulinUnits),
      insulinType,
      timeAdministered,
      site: injectionSite || undefined,
      notes: insulinNotes || undefined,
    });
  };

  const handleDelete = () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete this ${type === "glucose" ? "glucose reading" : "insulin record"}?`
    );
    
    if (confirmDelete) {
      if (type === "glucose") {
        deleteGlucoseMutation.mutate();
      } else {
        deleteInsulinMutation.mutate();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {type === "glucose" ? (
              <>
                <Droplets className="mr-2 h-5 w-5" />
                Edit Glucose Reading
              </>
            ) : (
              <>
                <Syringe className="mr-2 h-5 w-5" />
                Edit Insulin Record
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {type === "glucose" 
              ? "Update or delete your glucose reading" 
              : "Update or delete your insulin record"}
          </DialogDescription>
        </DialogHeader>

        {type === "glucose" ? (
          <form onSubmit={handleSubmitGlucose}>
            <div className="space-y-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="glucoseLevel">Glucose Level (mg/dL)</Label>
                <Input
                  id="glucoseLevel"
                  type="number"
                  placeholder="120"
                  value={glucoseLevel}
                  onChange={(e) => setGlucoseLevel(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="readingType">Reading Type</Label>
                <Select value={readingType} onValueChange={setReadingType}>
                  <SelectTrigger id="readingType">
                    <SelectValue placeholder="Select reading type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fasting">Fasting</SelectItem>
                    <SelectItem value="before-meal">Before Meal</SelectItem>
                    <SelectItem value="after-meal">After Meal (2 hours)</SelectItem>
                    <SelectItem value="bedtime">Bedtime</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        {format(readingDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={readingDate}
                        onSelect={(date) => date && setReadingDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={readingTime}
                    onChange={(e) => setReadingTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="glucoseNotes">Notes</Label>
                <Textarea
                  id="glucoseNotes"
                  placeholder="Add any additional information"
                  value={glucoseNotes}
                  onChange={(e) => setGlucoseNotes(e.target.value)}
                  className="min-h-[80px]"
                />
                <CharacterCount value={glucoseNotes} maxLength={500} />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:gap-0">
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleDelete}
                disabled={deleteGlucoseMutation.isPending || updateGlucoseMutation.isPending}
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={updateGlucoseMutation.isPending || deleteGlucoseMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateGlucoseMutation.isPending || deleteGlucoseMutation.isPending}
                >
                  {updateGlucoseMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleSubmitInsulin}>
            <div className="space-y-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="insulinUnits">Insulin Units</Label>
                <Input
                  id="insulinUnits"
                  type="number"
                  placeholder="10"
                  value={insulinUnits}
                  onChange={(e) => setInsulinUnits(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="insulinType">Insulin Type</Label>
                <Select value={insulinType} onValueChange={setInsulinType}>
                  <SelectTrigger id="insulinType">
                    <SelectValue placeholder="Select insulin type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rapid-acting">Rapid-Acting</SelectItem>
                    <SelectItem value="short-acting">Short-Acting</SelectItem>
                    <SelectItem value="intermediate-acting">Intermediate-Acting</SelectItem>
                    <SelectItem value="long-acting">Long-Acting</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        {format(readingDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={readingDate}
                        onSelect={(date) => date && setReadingDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={readingTime}
                    onChange={(e) => setReadingTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="injectionSite">Injection Site (optional)</Label>
                <Input
                  id="injectionSite"
                  placeholder="e.g., Left arm, Abdomen"
                  value={injectionSite}
                  onChange={(e) => setInjectionSite(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="insulinNotes">Notes</Label>
                <Textarea
                  id="insulinNotes"
                  placeholder="Add any additional information"
                  value={insulinNotes}
                  onChange={(e) => setInsulinNotes(e.target.value)}
                  className="min-h-[80px]"
                />
                <CharacterCount value={insulinNotes} maxLength={500} />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:gap-0">
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleDelete}
                disabled={deleteInsulinMutation.isPending || updateInsulinMutation.isPending}
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={updateInsulinMutation.isPending || deleteInsulinMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateInsulinMutation.isPending || deleteInsulinMutation.isPending}
                >
                  {updateInsulinMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}