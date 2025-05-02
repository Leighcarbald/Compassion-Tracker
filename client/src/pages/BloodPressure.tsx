import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabType } from "@/lib/types";
import { format } from "date-fns";
import { Activity, PlusCircle, ArrowLeft, ArrowRight, Heart, AlignLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BloodPressure } from "@shared/schema";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useCareRecipient } from "@/hooks/use-care-recipient";
import { CharacterCount } from "@/components/ui/character-count";

interface BloodPressurePageProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function BloodPressurePage({ activeTab, setActiveTab }: BloodPressurePageProps) {
  const { activeCareRecipientId } = useCareRecipient();
  const careRecipientId = activeCareRecipientId ? parseInt(activeCareRecipientId) : null;
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [readingDate, setReadingDate] = useState<Date>(new Date());
  const [readingTime, setReadingTime] = useState(format(new Date(), "HH:mm"));
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [oxygenLevel, setOxygenLevel] = useState("");
  const [position, setPosition] = useState("sitting");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const { data: readings, isLoading } = useQuery({
    queryKey: ["/api/blood-pressure", careRecipientId],
    queryFn: async () => {
      const response = await fetch(`/api/blood-pressure?careRecipientId=${careRecipientId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch blood pressure readings");
      }
      return response.json();
    },
    enabled: !!careRecipientId,
  });

  const addReadingMutation = useMutation({
    mutationFn: async (data: {
      careRecipientId: number;
      systolic: number;
      diastolic: number;
      pulse: number | null;
      oxygenLevel: number | null;
      timeOfReading: Date;
      position: string;
      notes: string;
    }) => {
      const response = await fetch("/api/blood-pressure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to add blood pressure reading");
      }
      return response.json();
    },
    onSuccess: () => {
      // Reset the form and hide it
      setShowAddForm(false);
      setSystolic("");
      setDiastolic("");
      setPulse("");
      setOxygenLevel("");
      setPosition("sitting");
      setNotes("");
      
      // Show success toast and invalidate queries
      toast({
        title: "Success",
        description: "Blood pressure reading added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/blood-pressure", careRecipientId] });
      // Also invalidate today's stats for dashboard updates
      queryClient.invalidateQueries({ queryKey: ["/api/care-stats/today", careRecipientId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!careRecipientId) {
      toast({
        title: "Error",
        description: "Please select a care recipient",
        variant: "destructive",
      });
      return;
    }
    
    // Validate the form
    if (!systolic || !diastolic) {
      toast({
        title: "Error",
        description: "Systolic and diastolic values are required",
        variant: "destructive",
      });
      return;
    }
    
    // Create the timestamp from the date and time
    const timeOfReading = new Date(readingDate);
    const [hours, minutes] = readingTime.split(':').map(Number);
    timeOfReading.setHours(hours, minutes);
    
    // Submit the form data
    addReadingMutation.mutate({
      careRecipientId,
      systolic: Number(systolic),
      diastolic: Number(diastolic),
      pulse: pulse ? Number(pulse) : null,
      oxygenLevel: oxygenLevel ? Number(oxygenLevel) : null,
      timeOfReading,
      position,
      notes,
    });
  };
  
  const getStatusColor = (reading: BloodPressure) => {
    // Determine color based on blood pressure category
    if (reading.systolic >= 180 || reading.diastolic >= 120) {
      return "text-red-600"; // Crisis (Stage 3)
    } else if (reading.systolic >= 140 || reading.diastolic >= 90) {
      return "text-red-500"; // Stage 2
    } else if ((reading.systolic >= 130 && reading.systolic < 140) || 
              (reading.diastolic >= 80 && reading.diastolic < 90)) {
      return "text-amber-500"; // Stage 1
    } else if ((reading.systolic >= 120 && reading.systolic < 130) && 
              reading.diastolic < 80) {
      return "text-amber-400"; // Elevated
    } else {
      return "text-green-500"; // Normal
    }
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Blood Pressure Tracker" icon={<Activity className="h-6 w-6" />} />
      
      <div className="flex justify-between items-center mb-6">
        <div></div> {/* Empty div for flex spacing */}
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? "Cancel" : "Add Reading"}
          {!showAddForm && <PlusCircle className="ml-2 h-4 w-4" />}
        </Button>
      </div>

      {/* Care recipient selector removed since we're using global context */}

      {showAddForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Add New Reading</CardTitle>
            <CardDescription>Record a new blood pressure reading</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="systolic">Systolic (mmHg)</Label>
                  <Input
                    id="systolic"
                    type="number"
                    placeholder="120"
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diastolic">Diastolic (mmHg)</Label>
                  <Input
                    id="diastolic"
                    type="number"
                    placeholder="80"
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="pulse">Pulse (bpm)</Label>
                  <Input
                    id="pulse"
                    type="number"
                    placeholder="70"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="oxygenLevel">Oxygen Level (%)</Label>
                  <Input
                    id="oxygenLevel"
                    type="number"
                    placeholder="98"
                    value={oxygenLevel}
                    onChange={(e) => setOxygenLevel(e.target.value)}
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Select value={position} onValueChange={setPosition}>
                    <SelectTrigger id="position">
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sitting">Sitting</SelectItem>
                      <SelectItem value="standing">Standing</SelectItem>
                      <SelectItem value="lying">Lying down</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  {/* Empty space for balance */}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

              <div className="space-y-2 mb-4">
                <Label htmlFor="notes" className="flex items-center space-x-1">
                  <span>Notes</span>
                  <span className="text-xs text-muted-foreground italic"> - Include details about abnormal readings</span>
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Add details about medication changes, symptoms, or circumstances that may affect readings"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px]"
                />
                <CharacterCount value={notes} maxLength={500} />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={addReadingMutation.isPending}
              >
                {addReadingMutation.isPending ? "Submitting..." : "Save Reading"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Activity className="mr-2 h-5 w-5" />
          Blood Pressure History
        </h2>
        
        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : !readings || readings.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No blood pressure readings recorded yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readings.map((reading: BloodPressure) => (
              <Card key={reading.id} className="overflow-hidden">
                <CardHeader className="pb-2 px-3 py-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">
                      <span className={getStatusColor(reading)}>
                        {reading.systolic}/{reading.diastolic}
                      </span> 
                      <span className="text-sm font-normal ml-1">mmHg</span>
                      {(reading.systolic >= 130 || reading.diastolic >= 80) && (
                        <span className={`text-xs font-medium ml-1 py-0.5 px-1 rounded ${
                          reading.systolic >= 180 || reading.diastolic >= 120 
                            ? "bg-red-100 text-red-800" 
                            : reading.systolic >= 140 || reading.diastolic >= 90
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                        }`}>
                          {reading.systolic >= 180 || reading.diastolic >= 120 
                            ? "Crisis" 
                            : reading.systolic >= 140 || reading.diastolic >= 90
                              ? "High"
                              : "Elevated"}
                        </span>
                      )}
                    </CardTitle>
                    <Heart className={`h-4 w-4 ${getStatusColor(reading)}`} />
                  </div>
                  <CardDescription className="text-xs">
                    {format(new Date(reading.timeOfReading), "MMM d, yyyy 'at' h:mm a")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-3 py-2">
                  <div className="space-y-1 text-sm">
                    {reading.pulse && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-xs">Pulse:</span>
                        <span className="text-xs">{reading.pulse} bpm</span>
                      </div>
                    )}
                    {reading.oxygenLevel && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-xs">O₂:</span>
                        <span className={`text-xs ${reading.oxygenLevel >= 95 ? "text-green-500" : reading.oxygenLevel >= 90 ? "text-amber-500" : "text-red-500"}`}>
                          {reading.oxygenLevel}%
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Position:</span>
                      <span className="capitalize text-xs">{reading.position || "Not recorded"}</span>
                    </div>
                    {reading.notes && (
                      <div className="pt-1 mt-1 border-t border-gray-100">
                        <div className="flex items-center gap-1 mb-1">
                          <AlignLeft className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground">Notes:</p>
                        </div>
                        <p className="text-xs line-clamp-2">
                          {reading.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Bottom Navigation */}
      <BottomNavigation 
        activeTab={activeTab} 
        onChangeTab={setActiveTab} 
      />
    </div>
  );
}