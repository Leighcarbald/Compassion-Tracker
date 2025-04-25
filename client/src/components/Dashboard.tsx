import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { formatTime } from "@/lib/utils";
import StatusCard from "./StatusCard";
import { Pill, Utensils, Toilet, Moon, Heart } from "lucide-react";
import { useLocation } from "wouter";

interface DashboardProps {
  careRecipientId: string | null;
  inspirationMessage?: { message: string; author: string } | null;
}

export default function Dashboard({ careRecipientId, inspirationMessage }: DashboardProps) {
  // Fetch today's stats
  const { data: todayStats } = useQuery<{
    medications: { completed: number; total: number; progress: number };
    meals: { completed: number; total: number; progress: number };
    bowelMovement: { lastTime: string };
    supplies: { depends: number };
    sleep: { duration: string; quality: string };
  }>({
    queryKey: ['/api/care-stats/today', careRecipientId],
    enabled: !!careRecipientId,
  });

  // Fetch upcoming events
  const { data: upcomingEvents, isLoading: isLoadingEvents } = useQuery<Array<{
    id: string;
    type: 'medication' | 'appointment' | 'meal' | 'sleep';
    title: string;
    time: string;
    details?: string;
  }>>({
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
        />

        {/* Meals Card */}
        <StatusCard
          title="Meals"
          value={todayStats?.meals?.completed || 0}
          total={todayStats?.meals?.total || 0}
          icon={<Utensils className="h-4 w-4" />}
          color="secondary"
          progress={todayStats?.meals?.progress || 0}
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
        />

        {/* Sleep Card */}
        <StatusCard
          title="Sleep"
          value={todayStats?.sleep?.duration || "No data"}
          icon={<Moon className="h-4 w-4" />}
          color="blue-400"
          secondaryText={todayStats?.sleep?.quality || ""}
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
                    ) : event.type === 'sleep' ? (
                      <Moon className="h-5 w-5 text-blue-400" />
                    ) : (
                      <span className="text-lg">👩‍⚕️</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{event.title}</div>
                    <div className="text-xs text-gray-500">
                      {/* Always use formatTime for any time format */}
                      {formatTime(event.time)}
                      {event.details && ` - ${event.details}`}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Inspiration */}
      <div className="mb-6 bg-primary bg-opacity-5 p-4 rounded-xl border border-primary border-opacity-10">
        <div className="flex items-center mb-2">
          <Heart className="h-5 w-5 text-primary mr-2" />
          <h3 className="text-md font-medium">Daily Inspiration</h3>
        </div>
        <p className="text-sm text-gray-700">
          {inspirationMessage ? (
            <>
              "{inspirationMessage.message}"
              <br />
              {inspirationMessage.author && `— ${inspirationMessage.author}`}
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
