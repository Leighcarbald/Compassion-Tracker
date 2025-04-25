import { useQuery } from "@tanstack/react-query";
import { Note } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatTime, getTimeAgo } from "@/lib/utils";
import StatusCard from "./StatusCard";
import { Pill, Utensils, Thermometer, Moon, Heart } from "lucide-react";

interface DashboardProps {
  careRecipientId: string | null;
  inspirationMessage?: { message: string; author: string } | null;
}

export default function Dashboard({ careRecipientId, inspirationMessage }: DashboardProps) {
  // Fetch today's stats
  const { data: todayStats } = useQuery({
    queryKey: ['/api/care-stats/today', careRecipientId],
    enabled: !!careRecipientId,
  });

  // Fetch upcoming events
  const { data: upcomingEvents, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['/api/events/upcoming', careRecipientId],
    enabled: !!careRecipientId,
  });

  // Fetch recent notes
  const { data: recentNotes, isLoading: isLoadingNotes } = useQuery<Note[]>({
    queryKey: ['/api/notes/recent', careRecipientId],
    enabled: !!careRecipientId,
  });

  return (
    <section className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <Button variant="ghost" size="sm" className="text-primary">
          Edit <span className="ml-1">✏️</span>
        </Button>
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
          icon={<Thermometer className="h-4 w-4" />}
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
              upcomingEvents.map((event: any) => (
                <div key={event.id} className="p-3 border-b border-gray-100 flex items-center">
                  <div 
                    className={`w-10 h-10 rounded-full bg-${event.type === 'medication' ? 'primary' : event.type === 'meal' ? 'secondary' : 'blue-400'} bg-opacity-10 flex items-center justify-center mr-3 text-${event.type === 'medication' ? 'primary' : event.type === 'meal' ? 'secondary' : 'blue-400'}`}
                  >
                    {event.type === 'medication' ? (
                      <Pill className="h-5 w-5" />
                    ) : event.type === 'meal' ? (
                      <Utensils className="h-5 w-5" />
                    ) : (
                      <span className="text-lg">👩‍⚕️</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{event.title}</div>
                    <div className="text-xs text-gray-500">
                      {formatTime(event.time)} {event.details && `- ${event.details}`}
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="ml-2 rounded-full h-8 w-8 p-0 flex items-center justify-center border border-gray-200 text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Mark as complete</span>
                    <span className="text-lg">✓</span>
                  </Button>
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

      {/* Recent Notes */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-md font-medium">Recent Notes</h3>
          <Button variant="link" size="sm" className="text-primary">See All</Button>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {isLoadingNotes ? (
              <div className="p-4 text-center text-gray-500">Loading notes...</div>
            ) : !recentNotes || recentNotes.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No notes found</div>
            ) : (
              recentNotes.slice(0, 2).map((note, index) => (
                <div key={note.id} className={`p-3 ${index < recentNotes.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-sm font-medium">{note.title}</div>
                    <div className="text-xs text-gray-500">{getTimeAgo(note.createdAt)}</div>
                  </div>
                  <p className="text-sm text-gray-700">
                    {note.content.length > 100 
                      ? `${note.content.substring(0, 100)}...` 
                      : note.content}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
