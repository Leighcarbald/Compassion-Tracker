import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";
import BottomNavigation from "@/components/BottomNavigation";
import { useQuery } from "@tanstack/react-query";
import { type InspirationMessage } from "@shared/schema";
import { TabType } from "@/lib/types";
import { useCareRecipient } from "@/hooks/use-care-recipient";

interface HomeProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function Home({ activeTab, setActiveTab }: HomeProps) {
  const { activeCareRecipientId, isLoading: isLoadingRecipients } = useCareRecipient();

  // Fetch daily inspiration
  const { data: inspirationMessage } = useQuery<InspirationMessage>({
    queryKey: ['/api/inspiration/daily'],
  });

  return (
    <>
      <Header 
        isLoading={isLoadingRecipients}
      />
      
      <main className="flex-1 overflow-auto pb-16">
        <Dashboard 
          careRecipientId={activeCareRecipientId} 
          inspirationMessage={inspirationMessage}
        />
      </main>
      
      <BottomNavigation 
        activeTab={activeTab} 
        onChangeTab={setActiveTab}
      />
    </>
  );
}
