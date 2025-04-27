import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Utensils, Plus, Loader2, Info, Calendar, Clock, Home } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BottomNavigation from "@/components/BottomNavigation";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TabType } from "@/lib/types";
import { type Meal } from "@shared/schema";
import AddMealModal from "@/components/AddMealModal";
import { useLocation } from "wouter";
import { useCareRecipient } from "@/hooks/use-care-recipient";
import PageHeader from "@/components/PageHeader";

interface MealsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function Meals({ activeTab, setActiveTab }: MealsProps) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddMealOpen, setIsAddMealOpen] = useState(false);
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  
  // Use global care recipient context
  const { activeCareRecipientId } = useCareRecipient();

  // Get meals for the active care recipient
  const { data: meals = [], isLoading: isLoadingMeals } = useQuery({
    queryKey: ['/api/meals', activeCareRecipientId],
    queryFn: async () => {
      if (!activeCareRecipientId) return [];
      const res = await fetch(`/api/meals?careRecipientId=${activeCareRecipientId}`);
      if (!res.ok) throw new Error('Failed to fetch meals');
      return res.json();
    },
    enabled: !!activeCareRecipientId
  });

  // Delete meal
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/meals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meals', activeCareRecipientId] });
      queryClient.invalidateQueries({ queryKey: ['/api/care-stats/today', activeCareRecipientId] });
      setIsDetailsOpen(false);
      toast({
        title: "Deleted",
        description: "Meal record has been deleted",
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

  const handleDeleteMeal = (id: number) => {
    if (confirm("Are you sure you want to delete this meal record?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleMealClick = (meal: Meal) => {
    setSelectedMeal(meal);
    setIsDetailsOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), 'h:mm a');
  };

  // Group meals by date for better organization
  const groupedMeals = meals.reduce((groups: Record<string, Meal[]>, meal: Meal) => {
    const date = formatDate(meal.consumedAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(meal);
    return groups;
  }, {});

  return (
    <div className="container p-4 max-w-4xl mx-auto">
      <PageHeader 
        title="Meal Tracking" 
        icon={<Utensils className="h-6 w-6" />}
        showHomeButton={false}
      />
      
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl flex items-center">
                <Utensils className="mr-2 h-6 w-6 text-primary" />
                Meal Tracking
              </CardTitle>
              <CardDescription>
                Track meals and food consumption
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddMealOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Meal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingMeals ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : Object.keys(groupedMeals).length === 0 ? (
            <div className="text-center p-8 border rounded-lg bg-muted/20">
              <Utensils className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium">No meals recorded</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking meals to monitor nutrition and eating habits
              </p>
              <Button onClick={() => setIsAddMealOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add First Meal
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedMeals)
                .sort((a: [string, any], b: [string, any]) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                .map(([date, dateMeals]: [string, Meal[]]) => (
                  <div key={date}>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                      {date}
                    </h3>
                    <div className="space-y-3">
                      {dateMeals
                        .sort((a: Meal, b: Meal) => new Date(b.consumedAt).getTime() - new Date(a.consumedAt).getTime())
                        .map((meal: Meal) => (
                          <Card 
                            key={meal.id} 
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleMealClick(meal)}
                          >
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium text-gray-900">{meal.food}</h4>
                                  <p className="text-sm text-gray-500 flex items-center mt-1">
                                    <Clock className="h-3.5 w-3.5 mr-1" />
                                    {formatTime(meal.consumedAt)}
                                  </p>
                                  {meal.type && (
                                    <p className="text-sm text-gray-500 mt-1">
                                      Type: {meal.type}
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
                                      handleMealClick(meal);
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
      
      {/* Meal Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        {selectedMeal && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center">
                <Utensils className="mr-2 h-5 w-5 text-primary" />
                Meal Details
              </DialogTitle>
              <DialogDescription>
                View detailed information about this meal
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <h4 className="font-semibold text-gray-500 text-sm">Food</h4>
                <p className="text-lg">{selectedMeal.food}</p>
              </div>
              
              {selectedMeal.type && (
                <div>
                  <h4 className="font-semibold text-gray-500 text-sm">Type</h4>
                  <p>{selectedMeal.type}</p>
                </div>
              )}
              
              <div>
                <h4 className="font-semibold text-gray-500 text-sm">Date & Time</h4>
                <p>{formatDate(selectedMeal.consumedAt)} at {formatTime(selectedMeal.consumedAt)}</p>
              </div>
              
              {selectedMeal.notes && (
                <div>
                  <h4 className="font-semibold text-gray-500 text-sm">Notes</h4>
                  <p className="whitespace-pre-wrap">{selectedMeal.notes}</p>
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
                  onClick={() => handleDeleteMeal(selectedMeal.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
      
      {/* Add Meal Modal */}
      <AddMealModal
        isOpen={isAddMealOpen}
        onClose={() => setIsAddMealOpen(false)}
        careRecipientId={activeCareRecipientId}
      />
      
      <BottomNavigation activeTab={activeTab} onChangeTab={setActiveTab} />
    </div>
  );
}