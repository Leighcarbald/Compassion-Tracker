import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, Pill, CalendarDays, ClipboardList, Plus } from "lucide-react";
import { TabType } from "@/lib/types";

interface BottomNavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onAddEvent: () => void;
}

export default function BottomNavigation({ activeTab, onChangeTab, onAddEvent }: BottomNavigationProps) {
  const [location, setLocation] = useLocation();

  const handleTabChange = (tab: TabType, path: string) => {
    onChangeTab(tab);
    setLocation(path);
  };

  return (
    <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 flex justify-around py-2 px-4 z-10">
      <Button
        variant="ghost"
        className={`flex flex-col items-center justify-center w-full h-auto py-1 ${
          activeTab === "home" ? "text-primary" : "text-gray-500"
        }`}
        onClick={() => handleTabChange("home", "/")}
      >
        <Home className="h-5 w-5" />
        <span className="text-xs mt-1">Home</span>
      </Button>

      <Button
        variant="ghost"
        className={`flex flex-col items-center justify-center w-full h-auto py-1 ${
          activeTab === "medications" ? "text-primary" : "text-gray-500"
        }`}
        onClick={() => handleTabChange("medications", "/medications")}
      >
        <Pill className="h-5 w-5" />
        <span className="text-xs mt-1">Meds</span>
      </Button>

      <Button
        className="bg-primary text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg p-0 hover:bg-primary/90"
        onClick={onAddEvent}
      >
        <Plus className="h-5 w-5" />
      </Button>

      <Button
        variant="ghost"
        className={`flex flex-col items-center justify-center w-full h-auto py-1 ${
          activeTab === "calendar" ? "text-primary" : "text-gray-500"
        }`}
        onClick={() => handleTabChange("calendar", "/calendar")}
      >
        <CalendarDays className="h-5 w-5" />
        <span className="text-xs mt-1">Calendar</span>
      </Button>

      <Button
        variant="ghost"
        className={`flex flex-col items-center justify-center w-full h-auto py-1 ${
          activeTab === "notes" ? "text-primary" : "text-gray-500"
        }`}
        onClick={() => handleTabChange("notes", "/notes")}
      >
        <ClipboardList className="h-5 w-5" />
        <span className="text-xs mt-1">Notes</span>
      </Button>
    </nav>
  );
}
