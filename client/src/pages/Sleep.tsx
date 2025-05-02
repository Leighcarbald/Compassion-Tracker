import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Moon, Plus, Loader2, Info, Calendar, Clock, Sun } from "lucide-react";
import { format, differenceInHours, differenceInMinutes } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BottomNavigation from "@/components/BottomNavigation";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TabType } from "@/lib/types";
import { type Sleep as SleepType } from "@shared/schema";
import AddSleepModal from "@/components/AddSleepModal";
import { useCareRecipient } from "@/hooks/use-care-recipient";
import PageHeader from "@/components/PageHeader";

interface SleepProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function Sleep({ activeTab, setActiveTab }: SleepProps) {
  const [selectedSleep, setSelectedSleep] = useState<SleepType | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddSleepOpen, setIsAddSleepOpen] = useState(false);
  const { toast } = useToast();
  
  // Use global care recipient context
  const { activeCareRecipientId } = useCareRecipient();

  // Get sleep records for the active care recipient
  const { data: sleepRecords = [], isLoading: isLoadingSleep } = useQuery({
    queryKey: ['/api/sleep', activeCareRecipientId],
    queryFn: async () => {
      if (!activeCareRecipientId) return [];
      // Use all=true to get all historical sleep records
      const res = await fetch(`/api/sleep?careRecipientId=${activeCareRecipientId}&all=true`);
      if (!res.ok) throw new Error('Failed to fetch sleep records');
      return res.json();
    },
    enabled: !!activeCareRecipientId
  });

  // Delete sleep record
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/sleep/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sleep', activeCareRecipientId] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today', activeCareRecipientId] });
      setIsDetailsOpen(false);
      toast({
        title: "Deleted",
        description: "Sleep record has been deleted",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete record: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleDeleteSleep = (id: number) => {
    if (confirm("Are you sure you want to delete this sleep record?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleSleepClick = (sleep: SleepType) => {
    setSelectedSleep(sleep);
    setIsDetailsOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), 'h:mm a');
  };

  const calculateDuration = (start: string, end: string | null) => {
    if (!end) return "In progress";
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const hours = differenceInHours(endDate, startDate);
    const minutes = differenceInMinutes(endDate, startDate) % 60;
    
    return `${hours}h ${minutes}m`;
  };

  // Group sleep records by date for better organization
  const groupedSleep = sleepRecords.reduce((groups: Record<string, SleepType[]>, sleep) => {
    const date = formatDate(sleep.startTime);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(sleep);
    return groups;
  }, {});

  const getQualityColor = (quality: string | null) => {
    if (!quality) return "bg-gray-200 text-gray-700";
    
    switch (quality.toLowerCase()) {
      case 'excellent': return "bg-green-100 text-green-800";
      case 'good': return "bg-blue-100 text-blue-800";
      case 'fair': return "bg-yellow-100 text-yellow-800";
      case 'poor': return "bg-orange-100 text-orange-800";
      case 'very poor': return "bg-red-100 text-red-800";
      default: return "bg-gray-200 text-gray-700";
    }
  };

  return (
    <div className="container p-4 max-w-4xl mx-auto">
      <PageHeader 
        title="Sleep Tracking" 
        icon={<Moon className="h-6 w-6" />}
      />
      
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl flex items-center">
                <Moon className="mr-2 h-6 w-6 text-primary" />
                Sleep Tracking
              </CardTitle>
              <CardDescription>
                Track sleep patterns and quality
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddSleepOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Sleep
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingSleep ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : Object.keys(groupedSleep).length === 0 ? (
            <div className="text-center p-8 border rounded-lg bg-muted/20">
              <Moon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium">No sleep records</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking sleep to monitor rest patterns
              </p>
              <Button onClick={() => setIsAddSleepOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add First Sleep Record
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedSleep)
                .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                .map(([date, dateSleep]) => (
                  <div key={date}>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                      {date}
                    </h3>
                    <div className="space-y-3">
                      {dateSleep
                        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                        .map((sleep) => (
                          <Card 
                            key={sleep.id} 
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleSleepClick(sleep)}
                          >
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center">
                                    <h4 className="font-medium text-gray-900">
                                      <Moon className="inline h-4 w-4 mr-1 text-indigo-500" /> 
                                      {formatTime(sleep.startTime)} 
                                      {sleep.endTime && (
                                        <>
                                          <span className="mx-1">→</span>
                                          <Sun className="inline h-4 w-4 mr-1 text-amber-500" /> 
                                          {formatTime(sleep.endTime)}
                                        </>
                                      )}
                                    </h4>
                                    {sleep.quality && (
                                      <Badge className={`ml-2 ${getQualityColor(sleep.quality)}`}>
                                        {sleep.quality}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  <p className="text-sm text-gray-500 mt-1">
                                    Duration: {calculateDuration(sleep.startTime, sleep.endTime)}
                                  </p>
                                  
                                  {sleep.notes && (
                                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                                      Notes: {sleep.notes}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSleepClick(sleep);
                                    }}
                                  >
                                    <Info className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Sleep Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        {selectedSleep && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center">
                <Moon className="mr-2 h-5 w-5 text-primary" />
                Sleep Details
              </DialogTitle>
              <DialogDescription>
                View detailed information about this sleep record
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <h4 className="font-semibold text-gray-500 text-sm">Bed Time</h4>
                <p className="text-lg">{formatTime(selectedSleep.startTime)}</p>
                <p className="text-sm text-gray-500">{formatDate(selectedSleep.startTime)}</p>
              </div>
              
              {selectedSleep.endTime && (
                <div>
                  <h4 className="font-semibold text-gray-500 text-sm">Wake Up Time</h4>
                  <p className="text-lg">{formatTime(selectedSleep.endTime)}</p>
                  <p className="text-sm text-gray-500">{formatDate(selectedSleep.endTime)}</p>
                </div>
              )}
              
              <div>
                <h4 className="font-semibold text-gray-500 text-sm">Duration</h4>
                <p>{calculateDuration(selectedSleep.startTime, selectedSleep.endTime)}</p>
              </div>
              
              {selectedSleep.quality && (
                <div>
                  <h4 className="font-semibold text-gray-500 text-sm">Sleep Quality</h4>
                  <Badge className={getQualityColor(selectedSleep.quality)}>
                    {selectedSleep.quality}
                  </Badge>
                </div>
              )}
              
              {selectedSleep.notes && (
                <div>
                  <h4 className="font-semibold text-gray-500 text-sm">Notes</h4>
                  <p className="whitespace-pre-wrap">{selectedSleep.notes}</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDetailsOpen(false)}
                >
                  Close
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => handleDeleteSleep(selectedSleep.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
      
      {/* Add Sleep Modal */}
      <AddSleepModal
        isOpen={isAddSleepOpen}
        onClose={() => setIsAddSleepOpen(false)}
        careRecipientId={activeCareRecipientId}
      />
      
      <BottomNavigation activeTab={activeTab} onChangeTab={setActiveTab} />
    </div>
  );
}