import { CareRecipient } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import { ChevronDown, Check, CalendarClock, Bell } from "lucide-react";
import CareRecipientTabs from "./CareRecipientTabs";

interface HeaderProps {
  activeCareRecipient: string | null;
  careRecipients: CareRecipient[];
  onChangeRecipient: (id: string) => void;
  isLoading?: boolean;
}

export default function Header({ 
  activeCareRecipient, 
  careRecipients, 
  onChangeRecipient, 
  isLoading = false 
}: HeaderProps) {
  const currentRecipient = careRecipients.find(
    recipient => recipient.id.toString() === activeCareRecipient
  );

  return (
    <header className="bg-white shadow-sm px-4 py-3 sticky top-0 z-10">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-semibold text-primary">CareCompanion</h1>
        </div>
        
        {isLoading ? (
          <Skeleton className="h-10 w-32" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="inline-flex justify-center items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md border border-gray-300 shadow-sm hover:bg-gray-50">
                {currentRecipient ? (
                  <span className="flex items-center">
                    <span 
                      className="h-2 w-2 rounded-full mr-2"
                      style={{ backgroundColor: currentRecipient.status === 'active' ? '#10B981' : '#F59E0B' }}
                    />
                    <span>{currentRecipient.name}</span>
                  </span>
                ) : (
                  <span>Select Recipient</span>
                )}
                <ChevronDown className="ml-2 h-4 w-4 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {careRecipients.map(recipient => (
                <DropdownMenuItem key={recipient.id} onClick={() => onChangeRecipient(recipient.id.toString())}>
                  <div className="flex items-center">
                    <span 
                      className="h-2 w-2 rounded-full mr-2"
                      style={{ backgroundColor: recipient.status === 'active' ? '#10B981' : '#F59E0B' }}
                    />
                    <span>{recipient.name}</span>
                    {recipient.id.toString() === activeCareRecipient && (
                      <Check className="ml-2 h-4 w-4" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      
      {/* Date Bar */}
      <div className="mt-3 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {formatDate(new Date())}
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="text-sm text-primary hover:text-primary hover:bg-primary/10">
            <CalendarClock className="h-4 w-4 mr-1" />
            Calendar
          </Button>
          <Button variant="ghost" size="sm" className="text-sm text-primary hover:text-primary hover:bg-primary/10 p-1">
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Care Recipient Tabs */}
      <CareRecipientTabs
        careRecipients={careRecipients}
        activeCareRecipient={activeCareRecipient}
        onChangeRecipient={onChangeRecipient}
        isLoading={isLoading}
      />
    </header>
  );
}
