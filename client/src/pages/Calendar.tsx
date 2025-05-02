import { useState, useEffect } from "react";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import AddCareEventModal from "@/components/AddCareEventModal";
import PageHeader from "@/components/PageHeader";
import StatusCard from "@/components/StatusCard";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, isSameDay } from "date-fns";
import { Appointment } from "@shared/schema";
import { TabType } from "@/lib/types";
import { formatTime, formatDate } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCareRecipient } from "@/hooks/use-care-recipient";
import { useLocation } from "wouter";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin,
  X,
  Pill,
  Utensils,
  Activity,
  Droplets,
  Syringe,
  Moon,
  FileText,
  AlertCircle
} from "lucide-react";

interface UpcomingEvent {
  id: string;
  type: string;
  title: string;
  time: string;
  details: string;
  scheduledFor?: string;
}

export function UpcomingMedicationDoses({ careRecipientId }: { careRecipientId: number | null }) {
  // Get wouter's navigator - always declare hooks at the top level
  const [_, navigate] = useLocation();
  
  const { data: upcomingEvents, isLoading } = useQuery<UpcomingEvent[]>({
    queryKey: ['/api/events/upcoming', careRecipientId],
    queryFn: async () => {
      const res = await fetch(`/api/events/upcoming?careRecipientId=${careRecipientId}`);
      if (!res.ok) throw new Error('Failed to fetch upcoming events');
      return res.json();
    },
    enabled: !!careRecipientId,
  });
  
  // Filter to only show medication events
  const medicationEvents = upcomingEvents?.filter(event => event.type === 'medication') || [];
  
  if (isLoading) {
    return (
      <div className="text-center p-4">
        <div className="animate-pulse h-4 bg-gray-200 rounded mb-2 w-3/4 mx-auto"></div>
        <div className="animate-pulse h-4 bg-gray-200 rounded mb-2 w-1/2 mx-auto"></div>
        <div className="animate-pulse h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
      </div>
    );
  }
  
  if (!medicationEvents.length) {
    return (
      <div className="text-center py-2">
        <p className="text-gray-500">No upcoming medication doses for today</p>
        <Button 
          variant="outline" 
          size="sm"
          className="mt-3" 
          onClick={() => {
            // Navigate to Medications page using wouter
            navigate('/medications');
          }}
        >
          <Pill className="h-4 w-4 mr-2" />
          Manage Medications
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {medicationEvents.map((event) => (
        <Card key={event.id} className="overflow-hidden border-l-4 border-l-primary">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Pill className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm text-gray-500 flex items-center">
                    <Clock className="h-3 w-3 mr-1" /> {formatTime(event.time)}
                  </p>
                  <p className="text-sm text-gray-600">{event.details}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface CalendarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function Calendar({ activeTab: navTab, setActiveTab: setNavTab }: CalendarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState("meds"); // Tab for the health data sections
  const [modalEventType, setModalEventType] = useState<string>("appointment");
  
  // Use global care recipient state
  const { 
    activeCareRecipientId: activeCareRecipient, 
    isLoading: isLoadingRecipients 
  } = useCareRecipient();

  // Format the selected date for API calls
  const formattedDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  
  // Check if selected date is today
  const isToday = selectedDate ? isSameDay(selectedDate, new Date()) : false;
  
  // Fetch detailed stats for the selected date (only for past dates, not today)  
  const { data: dateStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/care-stats/date', activeCareRecipient, formattedDate],
    queryFn: async () => {
      const res = await fetch(`/api/care-stats/date?careRecipientId=${activeCareRecipient}&date=${formattedDate}`);
      if (!res.ok) throw new Error('Failed to fetch date stats');
      return res.json();
    },
    enabled: !!activeCareRecipient && !!selectedDate && !isToday, // Don't fetch for today
  });
  
  // Fetch meals for the selected date
  const { data: meals, isLoading: isLoadingMeals } = useQuery({
    queryKey: ['/api/meals', activeCareRecipient, formattedDate],
    queryFn: async () => {
      console.log(`Fetching meals for date: ${formattedDate}, care recipient ID: ${activeCareRecipient}`);
      // Get all meals for this care recipient and filter on the client side by date
      const res = await fetch(`/api/meals?careRecipientId=${activeCareRecipient}&all=true`);
      if (!res.ok) throw new Error('Failed to fetch meals');
      
      const allMeals = await res.json();
      console.log(`Got ${allMeals.length} total meals for recipient ${activeCareRecipient}, data:`, allMeals);
      
      // Client-side filter for meals on this date
      if (selectedDate) {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        console.log(`Filtering meals between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);
        
        const filteredMeals = allMeals.filter((meal: any) => {
          const mealDate = new Date(meal.consumedAt);
          console.log(`Checking meal ${meal.id}, date: ${mealDate.toISOString()}, result: ${mealDate >= startOfDay && mealDate <= endOfDay}`);
          return mealDate >= startOfDay && mealDate <= endOfDay;
        });
        
        console.log(`Filtered to ${filteredMeals.length} meals for date ${formattedDate}`);
        return filteredMeals;
      }
      
      return allMeals;
    },
    enabled: !!activeCareRecipient && !!selectedDate && !isToday, // Don't fetch for today
  });

  // Fetch appointments for the selected date
  const { data: appointments, isLoading: isLoadingAppointments, refetch: refetchAppointments } = useQuery<Appointment[]>({
    queryKey: ['/api/appointments', activeCareRecipient, formattedDate],
    enabled: !!activeCareRecipient && !!selectedDate,
  });
  
  // Fetch all appointments for the current month for highlighting calendar
  const currentYearMonth = selectedDate ? format(selectedDate, 'yyyy-MM') : format(new Date(), 'yyyy-MM');
  const { data: allMonthAppointments } = useQuery<Appointment[]>({
    queryKey: ['/api/appointments/month', activeCareRecipient, currentYearMonth],
    queryFn: async () => {
      const res = await fetch(
        `/api/appointments/month?careRecipientId=${activeCareRecipient}&yearMonth=${currentYearMonth}`
      );
      if (!res.ok) throw new Error('Failed to fetch month appointments');
      return res.json();
    },
    enabled: !!activeCareRecipient,
  });
  
  // Delete appointment mutation
  const { mutate: deleteAppointment } = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/appointments/${id}`);
    },
    onSuccess: () => {
      refetchAppointments();
      queryClient.invalidateQueries({ 
        queryKey: ['/api/care-stats/date', activeCareRecipient, formattedDate] 
      });
    },
    onError: (error: Error) => {
      console.error('Error deleting appointment:', error);
    }
  });

  // Handle modal open/close
  const handleAddEvent = () => {
    setIsModalOpen(true);
  };
  
  // When the selected date changes, we may need to fetch appointments for a new month
  useEffect(() => {
    if (selectedDate) {
      const newYearMonth = format(selectedDate, 'yyyy-MM');
      if (newYearMonth !== currentYearMonth) {
        // Refresh the data for the new month
        queryClient.invalidateQueries({ 
          queryKey: ['/api/appointments/month', activeCareRecipient]
        });
      }
    }
  }, [selectedDate, currentYearMonth, activeCareRecipient]);

  // Function to check if a date has appointments
  const hasAppointmentOnDate = (date: Date): boolean => {
    if (!allMonthAppointments) return false;
    
    const dateString = format(date, 'yyyy-MM-dd');
    return allMonthAppointments.some(appointment => 
      appointment.date === dateString
    );
  };

  return (
    <>
      <Header
        isLoading={isLoadingRecipients}
      />
      
      <main className="flex-1 overflow-auto pb-16">
        <section className="p-4">
          <PageHeader 
            title={isToday ? "Today's Health Report" : "Historical Health Report"} 
            icon={<CalendarIcon className="h-6 w-6" />}
            showHomeButton={false}
          />

          {/* Calendar */}
          <Card className="mb-4">
            <CardContent className="p-2">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
                modifiersStyles={{
                  hasEvent: {
                    backgroundColor: 'rgba(var(--primary), 0.1)',
                    fontWeight: 'bold',
                    borderRadius: '100%',
                    position: 'relative',
                    color: 'rgb(var(--primary))'
                  }
                }}
                modifiers={{
                  hasEvent: (date) => hasAppointmentOnDate(date)
                }}
              />
            </CardContent>
          </Card>

          {/* Date Summary */}
          <div className="mb-4">
            <h3 className="text-md font-medium mb-3">
              {selectedDate && (
                <span className="flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
                  {format(selectedDate, 'MMMM d, yyyy')} Summary
                </span>
              )}
            </h3>

            {isToday ? (
              <>
                {/* Upcoming Medication Doses */}
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <h3 className="text-md font-medium mb-3 text-primary flex items-center">
                      <Pill className="h-4 w-4 mr-2" />
                      Upcoming Medication Doses
                    </h3>
                    {/* Convert activeCareRecipient to number for component */}
                    <UpcomingMedicationDoses careRecipientId={typeof activeCareRecipient === 'string' 
                      ? parseInt(activeCareRecipient) 
                      : activeCareRecipient} />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-500">Today's summary will be available tomorrow</p>
                    <p className="text-sm text-gray-400 mt-2">Data for today is still being collected</p>
                    <Button 
                      variant="outline" 
                      className="mt-4 text-primary" 
                      onClick={handleAddEvent}
                    >
                      Add an Event
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : isLoadingStats ? (
              <div className="p-4 text-center text-gray-500">Loading health data...</div>
            ) : !dateStats ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-500">No health data available for this date</p>
                  <Button 
                    variant="outline" 
                    className="mt-4 text-primary" 
                    onClick={handleAddEvent}
                  >
                    Add an Event
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">


                {/* Daily Health Details */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid grid-cols-7 mb-2">
                    <TabsTrigger value="meds">Meds</TabsTrigger>
                    <TabsTrigger value="bp">BP</TabsTrigger>
                    <TabsTrigger value="glucose">Glucose</TabsTrigger>
                    <TabsTrigger value="meals">Meals</TabsTrigger>
                    <TabsTrigger value="bowel">Bowel</TabsTrigger>
                    <TabsTrigger value="sleep">Sleep</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                  </TabsList>
                  
                  {/* Meds Tab */}
                  <TabsContent value="meds">
                    <h4 className="text-sm font-medium text-gray-700">Medication Logs</h4>
                    {!dateStats.medications?.logs || dateStats.medications.logs.length === 0 ? (
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-gray-500">No medications taken on this date</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {dateStats.medications.logs.map((log) => (
                          <Card key={log.id}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Pill className="h-4 w-4 text-blue-500" />
                                  <div>
                                    <p className="font-medium">
                                      {log.medication?.name || 
                                        (log.medicationId ? `Loading medication #${log.medicationId}...` : "Unknown medication")}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {formatTime(log.takenAt)}
                                      {log.medication?.dosage && `, ${log.medication.dosage}`}
                                    </p>
                                  </div>
                                </div>
                                <div>
                                  {log.taken && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      Taken
                                    </span>
                                  )}
                                </div>
                              </div>
                              {log.notes && (
                                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                  {log.notes}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Blood Pressure Tab */}
                  <TabsContent value="bp" className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700">Blood Pressure</h4>
                    {!dateStats.bloodPressure || dateStats.bloodPressure.length === 0 ? (
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-gray-500">No blood pressure readings</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {dateStats.bloodPressure.map((reading) => (
                          <Card key={reading.id}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-red-500" />
                                  <div>
                                    <p className="font-medium">
                                      {reading.systolic}/{reading.diastolic} mmHg
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {formatTime(reading.timeOfReading || reading.createdAt)}
                                      {reading.pulse && `, Pulse: ${reading.pulse} bpm`}
                                    </p>
                                    {reading.oxygenLevel && (
                                      <p className="text-sm text-gray-500">
                                        Oxygen: {reading.oxygenLevel}%
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {reading.notes && (
                                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                  {reading.notes}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Glucose Tab */}
                  <TabsContent value="glucose" className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700">Glucose Readings</h4>
                    {!dateStats.glucose || dateStats.glucose.length === 0 ? (
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-gray-500">No glucose readings</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {dateStats.glucose.map((reading) => (
                          <Card key={reading.id}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Droplets className="h-4 w-4 text-blue-500" />
                                  <div>
                                    <p className="font-medium">
                                      {reading.level} mg/dL
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {formatTime(reading.timeOfReading || reading.createdAt)}
                                      {reading.readingType && `, ${reading.readingType}`}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              {reading.notes && (
                                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                  {reading.notes}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Insulin Records */}
                    <h4 className="text-sm font-medium text-gray-700 mt-4">Insulin Records</h4>
                    {!dateStats.insulin || dateStats.insulin.length === 0 ? (
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-gray-500">No insulin records</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {dateStats.insulin.map((record) => (
                          <Card key={record.id}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Syringe className="h-4 w-4 text-purple-500" />
                                  <div>
                                    <p className="font-medium">
                                      {record.units} units
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {formatTime(record.timeAdministered || record.createdAt)}
                                      {record.insulinType && `, ${record.insulinType}`}
                                    </p>
                                    {record.site && (
                                      <p className="text-sm text-gray-500">
                                        Site: {record.site}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {record.notes && (
                                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                  {record.notes}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Meals Tab */}
                  <TabsContent value="meals" className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700">Meals</h4>
                    {isLoadingMeals ? (
                      <div className="p-4 text-center text-gray-500">Loading meals...</div>
                    ) : !meals || !Array.isArray(meals) || meals.length === 0 ? (
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-gray-500">No meals recorded</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {meals.map((meal) => (
                          <Card key={meal.id}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Utensils className="h-4 w-4 text-green-500" />
                                  <div>
                                    <p className="font-medium">
                                      {meal.type || 'Meal'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {formatTime(meal.consumedAt)}
                                    </p>
                                    {meal.food && (
                                      <p className="text-sm text-gray-500">
                                        Foods: {meal.food}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {meal.notes && (
                                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                  {meal.notes}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Bowel Tab */}
                  <TabsContent value="bowel" className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700">Bowel Movements</h4>
                    {!dateStats.bowelMovements || dateStats.bowelMovements.length === 0 ? (
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-gray-500">No bowel movements recorded</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {dateStats.bowelMovements.map((movement) => (
                          <Card key={movement.id}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">
                                    {formatTime(movement.occuredAt)}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    Type: {movement.type || 'Not specified'}
                                    {movement.color && `, Color: ${movement.color}`}
                                  </p>
                                  {movement.consistency && (
                                    <p className="text-sm text-gray-500">
                                      Consistency: {movement.consistency}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {movement.notes && (
                                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                  {movement.notes}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Sleep Tab */}
                  <TabsContent value="sleep" className="space-y-4">
                    {/* Sleep Records */}
                    <h4 className="text-sm font-medium text-gray-700">Sleep Records</h4>
                    {!dateStats.sleepRecords || dateStats.sleepRecords.length === 0 ? (
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-gray-500">No sleep records</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {dateStats.sleepRecords.map((record) => (
                          <Card key={record.id}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Moon className="h-4 w-4 text-indigo-400" />
                                  <div>
                                    <p className="font-medium">
                                      {formatTime(record.startTime)} - 
                                      {record.endTime ? formatTime(record.endTime) : ' In Progress'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      Quality: {record.quality || 'Not rated'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-medium">
                                    {record.endTime 
                                      ? `${((new Date(record.endTime).getTime() - new Date(record.startTime).getTime()) / (1000 * 60 * 60)).toFixed(1)} hrs` 
                                      : 'In progress'}
                                  </span>
                                </div>
                              </div>
                              {record.notes && (
                                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                  {record.notes}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Notes Tab */}
                  <TabsContent value="notes">
                    <h4 className="text-sm font-medium text-gray-700">Daily Notes</h4>
                    {!dateStats.notes || dateStats.notes.length === 0 ? (
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-gray-500">No notes for this date</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {dateStats.notes.map((note) => (
                          <Card key={note.id}>
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <FileText className="h-4 w-4 text-gray-500 mt-1" />
                                <div className="flex-1">
                                  <p className="text-sm text-gray-500">
                                    {formatTime(note.createdAt)}
                                  </p>
                                  <p className="mt-1">{note.content}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </section>
      </main>

      <BottomNavigation 
        activeTab={navTab} 
        onChangeTab={setNavTab} 
        onAddEvent={handleAddEvent}
      />
      
      {isModalOpen && (
        <AddCareEventModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          careRecipientId={activeCareRecipient}
          selectedDate={selectedDate}
          defaultEventType={modalEventType === "appointment" ? "appointment" : undefined}
        />
      )}
    </>
  );
}