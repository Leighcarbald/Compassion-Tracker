import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CareRecipient } from "@shared/schema";

type CareRecipientContextType = {
  activeCareRecipientId: string | null;
  setActiveCareRecipientId: (id: string | null) => void;
  careRecipients: CareRecipient[] | undefined;
  selectedCareRecipient: CareRecipient | undefined;
  isLoading: boolean;
};

export const CareRecipientContext = createContext<CareRecipientContextType | null>(null);

export function CareRecipientProvider({ children }: { children: ReactNode }) {
  const [activeCareRecipientId, setActiveCareRecipientId] = useState<string | null>(
    localStorage.getItem("activeCareRecipientId")
  );

  // Fetch care recipients
  const { data: careRecipients, isLoading } = useQuery<CareRecipient[]>({
    queryKey: ['/api/care-recipients'],
  });

  // Find the selected care recipient object based on activeCareRecipientId
  const selectedCareRecipient = careRecipients?.find(
    recipient => recipient.id.toString() === activeCareRecipientId
  );

  // Set default active recipient if none selected
  useEffect(() => {
    if (!activeCareRecipientId && careRecipients && careRecipients.length > 0) {
      const firstId = careRecipients[0].id.toString();
      setActiveCareRecipientId(firstId);
    }
  }, [careRecipients, activeCareRecipientId]);

  // Save active care recipient to localStorage whenever it changes
  useEffect(() => {
    if (activeCareRecipientId) {
      localStorage.setItem("activeCareRecipientId", activeCareRecipientId);
    }
  }, [activeCareRecipientId]);

  return (
    <CareRecipientContext.Provider
      value={{
        activeCareRecipientId,
        setActiveCareRecipientId,
        careRecipients,
        selectedCareRecipient,
        isLoading
      }}
    >
      {children}
    </CareRecipientContext.Provider>
  );
}

export function useCareRecipient() {
  const context = useContext(CareRecipientContext);
  if (!context) {
    throw new Error("useCareRecipient must be used within a CareRecipientProvider");
  }
  return context;
}