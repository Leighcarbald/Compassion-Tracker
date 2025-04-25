import { useState } from "react";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import AddCareEventModal from "@/components/AddCareEventModal";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { MedicationLog, CareRecipient, Medication } from "@shared/schema";
import { TabType } from "@/lib/types";
import { formatTime, getTimeAgo } from "@/lib/utils";
import { 
  Pill, 
  Check, 
  PillBottle, 
  Tablets, 
  Package2,
  Plus 
} from "lucide-react";

interface MedicationsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function Medications({ activeTab, setActiveTab }: MedicationsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCareRecipient, setActiveCareRecipient] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'today' | 'week' | 'all'>('today');

  // Fetch care recipients
  const { data: careRecipients, isLoading: isLoadingRecipients } = useQuery<CareRecipient[]>({
    queryKey: ['/api/care-recipients'],
  });

  // Set default active recipient if none selected
  if (!activeCareRecipient && careRecipients && careRecipients.length > 0) {
    setActiveCareRecipient(String(careRecipients[0].id));
  }

  // Fetch medications
  const { data: medications, isLoading: isLoadingMedications } = useQuery<Medication[]>({
    queryKey: ['/api/medications', activeCareRecipient, activeFilter],
    enabled: !!activeCareRecipient,
  });

  // Fetch medication logs (history)
  const { data: medicationLogs } = useQuery<MedicationLog[]>({
    queryKey: ['/api/medication-logs', activeCareRecipient],
    enabled: !!activeCareRecipient,
  });

  // Handle modal open/close
  const handleAddEvent = () => {
    setIsModalOpen(true);
  };

  // Handle recipient change
  const handleChangeRecipient = (id: string) => {
    setActiveCareRecipient(id);
  };

  // Render medication icon based on the type
  const renderMedicationIcon = (type: string, color: string) => {
    const iconProps = { className: `text-${color}-500`, size: 20 };
    
    switch (type) {
      case "pills":
        return <PillBottle {...iconProps} />;
      case "tablets":
        return <Tablets {...iconProps} />;
      case "capsules":
        return <Package2 {...iconProps} />;
      default:
        return <Pill {...iconProps} />;
    }
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
            <h2 className="text-lg font-semibold">Medications</h2>
            <Button size="sm" variant="outline" className="text-primary" onClick={() => setIsModalOpen(true)}>
              Add New <Plus className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {/* Filters */}
          <div className="flex mb-4 text-sm">
            <Button 
              variant={activeFilter === 'today' ? 'default' : 'outline'} 
              size="sm" 
              className={`mr-2 rounded-full ${activeFilter === 'today' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => setActiveFilter('today')}
            >
              Today
            </Button>
            <Button 
              variant={activeFilter === 'week' ? 'default' : 'outline'} 
              size="sm" 
              className={`mr-2 rounded-full ${activeFilter === 'week' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => setActiveFilter('week')}
            >
              This Week
            </Button>
            <Button 
              variant={activeFilter === 'all' ? 'default' : 'outline'} 
              size="sm" 
              className={`rounded-full ${activeFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => setActiveFilter('all')}
            >
              All
            </Button>
          </div>

          {/* Medication List */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 mb-6">
            {isLoadingMedications ? (
              <div className="p-8 text-center text-gray-500">Loading medications...</div>
            ) : !medications || medications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No medications found</div>
            ) : (
              medications.map((med) => (
                <div key={med.id} className="p-3 border-b border-gray-100">
                  <div className="flex items-start mb-2">
                    <div className={`w-10 h-10 rounded-full bg-${med.iconColor.replace('#', '')}-100 flex items-center justify-center mr-3`}>
                      {renderMedicationIcon(med.icon, med.iconColor.replace('#', ''))}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-medium">{med.name}</div>
                          <div className="text-xs text-gray-500">{med.dosage}</div>
                        </div>
                        {med.currentQuantity !== undefined && med.currentQuantity <= (med.reorderThreshold || 5) ? (
                          <div className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Reorder Soon
                          </div>
                        ) : (
                          <div className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            In Stock
                          </div>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {med.instructions || "Take as directed"}
                      </div>
                      
                      {/* Inventory Section */}
                      <div className="mt-2 p-2 bg-gray-50 rounded-md text-xs">
                        <div className="flex justify-between text-gray-600">
                          <span>Quantity: {med.currentQuantity || 0}</span>
                          <span>Refills: {med.refillsRemaining || 0}</span>
                        </div>
                        {med.prescribingDoctor && (
                          <div className="mt-1 text-gray-500">
                            Dr. {med.prescribingDoctor.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs font-medium text-blue-500 px-2 py-1 rounded-full border border-blue-500"
                      onClick={() => handleInventoryUpdate(med.id)}
                    >
                      Update Inventory
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs font-medium text-primary px-3 py-1 rounded-full border border-primary"
                      onClick={() => handleMarkAsTaken(med.id)}
                    >
                      Mark as Taken
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Medication History */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-md font-medium">Medication History</h3>
              <Button variant="link" size="sm" className="text-primary">See All</Button>
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              {!medicationLogs || medicationLogs.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No medication history</div>
              ) : (
                medicationLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="p-3 border-b border-gray-100 text-sm">
                    <div className="flex justify-between">
                      <div>{log.medicationId} - {log.notes}</div>
                      <div className="text-xs text-gray-500">{getTimeAgo(log.takenAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
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
        defaultEventType="medication"
      />
    </>
  );
}
