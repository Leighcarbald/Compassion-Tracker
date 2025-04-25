import { useState } from "react";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";
import BottomNavigation from "@/components/BottomNavigation";
import AddCareEventModal from "@/components/AddCareEventModal";
import { useQuery } from "@tanstack/react-query";
import { type CareRecipient } from "@shared/schema";
import { TabType } from "@/lib/types";

interface HomeProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function Home({ activeTab, setActiveTab }: HomeProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCareRecipient, setActiveCareRecipient] = useState<string | null>(null);

  // Fetch care recipients
  const { data: careRecipients, isLoading: isLoadingRecipients } = useQuery<CareRecipient[]>({
    queryKey: ['/api/care-recipients'],
  });

  // Set default active recipient if none selected
  if (!activeCareRecipient && careRecipients && careRecipients.length > 0) {
    setActiveCareRecipient(String(careRecipients[0].id));
  }

  // Fetch daily inspiration
  const { data: inspirationMessage } = useQuery({
    queryKey: ['/api/inspiration/daily'],
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
        <Dashboard 
          careRecipientId={activeCareRecipient} 
          inspirationMessage={inspirationMessage}
        />
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
      />
    </>
  );
}
