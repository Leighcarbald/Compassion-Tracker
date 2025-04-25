import { useState } from "react";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import AddCareEventModal from "@/components/AddCareEventModal";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { CareRecipient, Appointment } from "@shared/schema";
import { TabType } from "@/lib/types";
import { formatTime } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin,
  X,
  Plus
} from "lucide-react";

interface CalendarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function Calendar({ activeTab, setActiveTab }: CalendarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCareRecipient, setActiveCareRecipient] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Fetch care recipients
  const { data: careRecipients, isLoading: isLoadingRecipients } = useQuery<CareRecipient[]>({
    queryKey: ['/api/care-recipients'],
  });

  // Set default active recipient if none selected
  if (!activeCareRecipient && careRecipients && careRecipients.length > 0) {
    setActiveCareRecipient(String(careRecipients[0].id));
  }

  // Fetch appointments
  const { data: appointments, isLoading: isLoadingAppointments, refetch: refetchAppointments } = useQuery<Appointment[]>({
    queryKey: ['/api/appointments', activeCareRecipient, selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null],
    enabled: !!activeCareRecipient && !!selectedDate,
  });
  
  // Delete appointment mutation
  const { mutate: deleteAppointment } = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/appointments/${id}`);
    },
    onSuccess: () => {
      refetchAppointments();
    },
    onError: (error: Error) => {
      console.error('Error deleting appointment:', error);
    }
  });

  // Handle modal open/close
  const handleAddEvent = () => {
    setIsModalOpen(true);
  };

  // Handle recipient change
  const handleChangeRecipient = (id: string) => {
    setActiveCareRecipient(id);
  };

  return (
    <>
      <Header 
        activeCareRecipient={activeCareRecipient} 
        careRecipients={careRecipients || []} 
        onChangeRecipient={handleChangeRecipient}
        isLoading={isLoadingRecipients}
      />
      
      <main className="flex-1 overflow-auto pb-16">
        <section className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Calendar</h2>
            <Button size="sm" variant="outline" className="text-primary" onClick={() => setIsModalOpen(true)}>
              Add Event <Plus className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {/* Calendar */}
          <Card className="mb-4">
            <CardContent className="p-2">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
                // We'll implement date highlights differently in a future update
              />
            </CardContent>
          </Card>

          {/* Events for selected date */}
          <div className="mb-4">
            <h3 className="text-md font-medium mb-3">
              {selectedDate && (
                <span className="flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
                  Events for {format(selectedDate, 'MMMM d, yyyy')}
                </span>
              )}
            </h3>

            {isLoadingAppointments ? (
              <div className="p-4 text-center text-gray-500">Loading appointments...</div>
            ) : !appointments || appointments.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-500">No events scheduled for this date</p>
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
              <div className="space-y-3">
                {appointments.map((appointment) => (
                  <Card key={appointment.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="p-3 border-l-4 border-primary">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{appointment.title}</h4>
                            <div className="text-sm text-gray-500 mt-1 flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatTime(appointment.time)}
                            </div>
                            {appointment.location && (
                              <div className="text-sm text-gray-500 flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                {appointment.location}
                              </div>
                            )}
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-gray-400 h-8 w-8 p-0"
                            onClick={() => deleteAppointment(appointment.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {appointment.notes && (
                          <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {appointment.notes}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      
      <BottomNavigation 
        activeTab={activeTab} 
        onChangeTab={setActiveTab} 
        onAddEvent={handleAddEvent}
      />

      <AddCareEventModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        careRecipientId={activeCareRecipient}
        defaultEventType="appointment"
        selectedDate={selectedDate}
      />
    </>
  );
}
