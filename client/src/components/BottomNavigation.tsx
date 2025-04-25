import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Pill, 
  CalendarDays, 
  ClipboardList, 
  Plus, 
  MoreHorizontal, 
  User, 
  Building2,
  AlertCircle,
  ShieldAlert,
  Activity,
  Droplets,
  Toilet
} from "lucide-react";
import { TabType } from "@/lib/types";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BottomNavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onAddEvent: () => void;
}

export default function BottomNavigation({ activeTab, onChangeTab, onAddEvent }: BottomNavigationProps) {
  const [location, setLocation] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleTabChange = (tab: TabType, path: string) => {
    onChangeTab(tab);
    setLocation(path);
    setIsMenuOpen(false);
  };

  // Check if the active tab is in the "more" section
  const isMoreActive = activeTab === "doctors" || activeTab === "pharmacies" || activeTab === "notes" || activeTab === "emergency" || activeTab === "blood-pressure" || activeTab === "glucose-insulin";

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

      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`flex flex-col items-center justify-center w-full h-auto py-1 ${
              isMoreActive ? "text-primary" : "text-gray-500"
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-xs mt-1">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => handleTabChange("notes", "/notes")} className="cursor-pointer">
            <ClipboardList className="h-4 w-4 mr-2" />
            <span>Notes</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleTabChange("doctors", "/doctors")} className="cursor-pointer">
            <User className="h-4 w-4 mr-2" />
            <span>Doctors</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleTabChange("pharmacies", "/pharmacies")} className="cursor-pointer">
            <Building2 className="h-4 w-4 mr-2" />
            <span>Pharmacies</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleTabChange("blood-pressure", "/blood-pressure")} className="cursor-pointer">
            <Activity className="h-4 w-4 mr-2 text-blue-500" />
            <span>Blood Pressure</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleTabChange("glucose-insulin", "/glucose-insulin")} className="cursor-pointer">
            <Droplets className="h-4 w-4 mr-2 text-blue-500" />
            <span>Glucose & Insulin</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleTabChange("emergency", "/emergency")} className="cursor-pointer">
            <ShieldAlert className="h-4 w-4 mr-2 text-red-500" />
            <span>Emergency Info</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
