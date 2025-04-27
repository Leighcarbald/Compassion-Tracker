import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CalendarPlus, Clock, ClipboardList, Loader2, Plus, Toilet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatTime } from "@/lib/utils";
import { TabType } from "@/lib/types";
import { BowelMovement } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import AddBowelMovementModal from "@/components/AddBowelMovementModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BowelMovementsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function BowelMovements({ activeTab, setActiveTab }: BowelMovementsProps) {
  const [selectedMovement, setSelectedMovement] = useState<BowelMovement | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [activeCareRecipient, setActiveCareRecipient] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Get care recipients
  const { data: careRecipients = [], isLoading: isLoadingRecipients } = useQuery({
    queryKey: ['/api/care-recipients'],
    queryFn: async () => {
      const res = await fetch('/api/care-recipients');
      if (!res.ok) throw new Error('Failed to fetch care recipients');
      return res.json();
    }
  });

  // Set active care recipient if not set and data is available
  useEffect(() => {
    if (!activeCareRecipient && careRecipients.length > 0) {
      setActiveCareRecipient(careRecipients[0].id.toString());
    }
  }, [careRecipients, activeCareRecipient]);

  // Get bowel movements for the active care recipient
  const { data: movements = [], isLoading: isLoadingMovements } = useQuery({
    queryKey: ['/api/bowel-movements', activeCareRecipient],
    queryFn: async () => {
      if (!activeCareRecipient) return [];
      const res = await fetch(`/api/bowel-movements?careRecipientId=${activeCareRecipient}`);
      if (!res.ok) throw new Error('Failed to fetch bowel movements');
      return res.json();
    },
    enabled: !!activeCareRecipient
  });

  // Delete bowel movement
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/bowel-movements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bowel-movements', activeCareRecipient] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today', activeCareRecipient] });
      setIsDetailsOpen(false);
      toast({
        title: "Deleted",
        description: "Bowel movement record has been deleted",
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

  const handleDeleteMovement = (id: number) => {
    if (confirm("Are you sure you want to delete this record?")) {
      deleteMutation.mutate(id);
    }
  };

  const getBowelTypeLabel = (type: string | null) => {
    if (!type) return "Not specified";
    
    // First letter uppercase, rest lowercase
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  };

  const getTypeColor = (type: string | null) => {
    if (!type) return "bg-gray-200 text-gray-700";
    
    const lowercaseType = type.toLowerCase();
    
    if (lowercaseType.includes("hard") || lowercaseType.includes("constipat")) {
      return "bg-amber-100 text-amber-800";
    } else if (lowercaseType.includes("soft") || lowercaseType.includes("loose")) {
      return "bg-green-100 text-green-800";
    } else if (lowercaseType.includes("liquid") || lowercaseType.includes("diarrhea")) {
      return "bg-red-100 text-red-800";
    } else if (lowercaseType.includes("normal") || lowercaseType.includes("regular")) {
      return "bg-blue-100 text-blue-800";
    } else {
      return "bg-purple-100 text-purple-800";
    }
  };

  return (
    <div className="container p-4 max-w-4xl mx-auto">
      <Header 
        activeCareRecipient={activeCareRecipient} 
        careRecipients={careRecipients} 
        onChangeRecipient={(id) => setActiveCareRecipient(id)}
        isLoading={isLoadingRecipients}
      />
      
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl flex items-center">
                <Toilet className="mr-2 h-6 w-6 text-primary" />
                Bowel Movement Tracking
              </CardTitle>
              <CardDescription>
                Track and monitor bowel movements to maintain digestive health
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddEventOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Record
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingMovements ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center p-8 border rounded-lg bg-muted/20">
              <Toilet className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium">No bowel movements recorded</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking bowel movements to maintain digestive health
              </p>
              <Button onClick={() => setIsAddEventOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Record
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="list" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="list">
                  <ClipboardList className="h-4 w-4 mr-2" /> List View
                </TabsTrigger>
                <TabsTrigger value="calendar">
                  <CalendarPlus className="h-4 w-4 mr-2" /> Calendar View
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="list">
                <ScrollArea className="h-[400px] rounded-md border">
                  <div className="p-4 space-y-4">
                    {movements.map((movement: BowelMovement) => (
                      <div 
                        key={movement.id} 
                        className="flex justify-between items-center p-3 border rounded-lg hover:bg-accent cursor-pointer"
                        onClick={() => {
                          setSelectedMovement(movement);
                          setIsDetailsOpen(true);
                        }}
                      >
                        <div className="flex items-center">
                          <div className="bg-primary/10 p-2 rounded-full mr-3">
                            <Toilet className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">
                              <Badge className={getTypeColor(movement.type)}>
                                {getBowelTypeLabel(movement.type)}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center mt-1">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDate(movement.occuredAt)} at {formatTime(movement.occuredAt)}
                            </div>
                          </div>
                        </div>
                        {movement.notes && (
                          <div className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {movement.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="calendar">
                <div className="p-4 border rounded-lg">
                  <p className="text-center text-muted-foreground">Calendar view coming soon</p>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
      
      {/* Details Dialog */}
      {selectedMovement && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Bowel Movement Details</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center">
                <Badge className={getTypeColor(selectedMovement.type)}>
                  {getBowelTypeLabel(selectedMovement.type)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDate(selectedMovement.occuredAt)} at {formatTime(selectedMovement.occuredAt)}
                </span>
              </div>
              
              {selectedMovement.notes && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Notes</h4>
                  <p className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/20">
                    {selectedMovement.notes}
                  </p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  variant="destructive" 
                  onClick={() => handleDeleteMovement(selectedMovement.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Delete
                </Button>
                <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Add Event Modal */}
      <AddBowelMovementModal 
        isOpen={isAddEventOpen}
        onClose={() => setIsAddEventOpen(false)}
        careRecipientId={activeCareRecipient}
      />
    </div>
  );
}