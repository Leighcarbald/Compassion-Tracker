import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { formatTime } from "@/lib/utils";
import StatusCard from "./StatusCard";
import { Pill, Utensils, Toilet, Moon, Heart, Activity, Droplets, Calendar, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { EventData, DailyStats } from "@/lib/types";
import { format } from "date-fns";

interface DashboardProps {
  careRecipientId: string | null;
  inspirationMessage?: { message: string; author: string } | null;
}

export default function Dashboard({ careRecipientId, inspirationMessage }: DashboardProps) {
  // Fetch today's stats
  const { data: todayStats } = useQuery<DailyStats>({
    queryKey: ['/api/care-stats/today', careRecipientId],
    enabled: !!careRecipientId,
  });

  // Fetch upcoming events
  const { data: upcomingEvents, isLoading: isLoadingEvents } = useQuery<Array<EventData>>({
    queryKey: ['/api/events/upcoming', careRecipientId],
    enabled: !!careRecipientId,
  });

  // No longer fetching recent notes for dashboard

  const [_, setLocation] = useLocation();
  
  return (
    <section className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Dashboard</h2>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Medications Card */}
        <StatusCard
          title="Medications"
          value={todayStats?.medications?.completed || 0}
          total={todayStats?.medications?.total || 0}
          icon={<Pill className="h-4 w-4" />}
          color="primary"
          progress={todayStats?.medications?.progress || 0}
          onClick={() => setLocation(`/medications?careRecipientId=${careRecipientId}`)}
        />

        {/* Blood Pressure Card */}
        <StatusCard
          title="Blood Pressure"
          value={todayStats?.bloodPressure && todayStats.bloodPressure.length > 0 
            ? `${todayStats.bloodPressure[0].systolic}/${todayStats.bloodPressure[0].diastolic}`
            : "No readings"}
          icon={<Activity className="h-4 w-4" />}
          color="red-500"
          secondaryText={todayStats?.bloodPressure && todayStats.bloodPressure.length > 0 
            ? `Pulse: ${todayStats.bloodPressure[0].pulse}`
            : ""}
          onClick={() => setLocation(`/blood-pressure?careRecipientId=${careRecipientId}`)}
        />

        {/* Glucose/Insulin Card */}
        <StatusCard
          title="Glucose/Insulin"
          value={todayStats?.glucose && todayStats.glucose.length > 0 
            ? `${todayStats.glucose[0].level} mg/dL`
            : todayStats?.insulin && todayStats.insulin.length > 0 
              ? `${todayStats.insulin[0].units} units`
              : "No readings"}
          icon={<Droplets className="h-4 w-4" />}
          color="blue-500"
          secondaryText={todayStats?.glucose && todayStats.glucose.length > 0 
            ? `${todayStats.glucose[0].readingType || ""}` 
            : todayStats?.insulin && todayStats.insulin.length > 0 
              ? `${todayStats.insulin[0].insulinType || ""}`
              : ""}
          onClick={() => setLocation(`/glucose-insulin?careRecipientId=${careRecipientId}`)}
        />

        {/* Meals Card */}
        <StatusCard
          title="Meals"
          value={todayStats?.meals?.completed || 0}
          total={todayStats?.meals?.total || 0}
          icon={<Utensils className="h-4 w-4" />}
          color="secondary"
          progress={todayStats?.meals?.progress || 0}
          onClick={() => setLocation(`/meals?careRecipientId=${careRecipientId}`)}
        />

        {/* Bowel Movements Card */}
        <StatusCard
          title="Bowel Movement"
          value={todayStats?.bowelMovement?.lastTime || "None today"}
          icon={<Toilet className="h-4 w-4" />}
          color="accent"
          secondaryText={todayStats?.supplies?.depends 
            ? `${todayStats.supplies.depends} depends remaining` 
            : "No supply data"}
          onClick={() => setLocation(`/bowel-movements?careRecipientId=${careRecipientId}`)}
        />

        {/* Sleep Card */}
        <StatusCard
          title="Sleep"
          value={todayStats?.sleep?.duration || "No data"}
          icon={<Moon className="h-4 w-4" />}
          color="blue-400"
          secondaryText={todayStats?.sleep?.quality || ""}
          onClick={() => setLocation(`/sleep?careRecipientId=${careRecipientId}`)}
        />
      </div>

      {/* Next Up Section */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-3">Next Up</h3>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {isLoadingEvents ? (
              <div className="p-4 text-center text-gray-500">Loading events...</div>
            ) : !upcomingEvents || upcomingEvents.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No upcoming events</div>
            ) : (
              upcomingEvents.map((event) => (
                <div key={event.id} className="p-3 border-b border-gray-100 flex items-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3">
                    {event.type === 'medication' ? (
                      <Pill className="h-5 w-5 text-primary" />
                    ) : event.type === 'meal' ? (
                      <Utensils className="h-5 w-5 text-secondary" />
                    ) : event.type === 'appointment' ? (
                      <Calendar className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{event.title}</span>
                      {event.source && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          event.source === 'schedule' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {event.source === 'schedule' ? 'Auto' : 'Manual'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {/* Always use formatTime for any time format */}
                      {formatTime(event.time)}
                      {event.details && ` - ${event.details}`}
                    </div>
                    {/* Show date if not today */}
                    {event.date && event.date !== format(new Date(), 'yyyy-MM-dd') && (
                      <div className="text-xs text-primary-600 mt-1">
                        {new Date(event.date).toLocaleDateString(undefined, {
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Inspiration */}
      <div className="mb-6 p-4 rounded-xl border border-gray-200">
        <div className="flex items-center mb-2">
          <Heart className="h-5 w-5 text-primary mr-2" />
          <h3 className="text-md font-medium">Daily Inspiration</h3>
        </div>
        <p className="text-sm text-gray-700">
          {inspirationMessage ? (
            <>
              "{inspirationMessage.message}"
              <br />
              {inspirationMessage.author && <span className="text-gray-500 text-sm">— {inspirationMessage.author}</span>}
            </>
          ) : (
            "Caregiving often calls us to lean into love we didn't know possible."
          )}
        </p>
      </div>

      {/* Notes section removed as requested */}
    </section>
  );
}
