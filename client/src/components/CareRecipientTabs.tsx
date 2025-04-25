import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type CareRecipient } from "@shared/schema";
import { Plus } from "lucide-react";

interface CareRecipientTabsProps {
  careRecipients: CareRecipient[];
  activeCareRecipient: string | null;
  onChangeRecipient: (id: string) => void;
  isLoading?: boolean;
}

export default function CareRecipientTabs({
  careRecipients,
  activeCareRecipient,
  onChangeRecipient,
  isLoading = false
}: CareRecipientTabsProps) {
  if (isLoading) {
    return (
      <div className="mt-3 border-b border-gray-200">
        <div className="flex space-x-6 overflow-x-auto pb-1 scrollbar-hide">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 border-b border-gray-200">
      <div className="flex space-x-6 overflow-x-auto pb-1 scrollbar-hide">
        {careRecipients.map((recipient) => (
          <Button
            key={recipient.id}
            variant="ghost"
            className={`py-2 px-1 font-medium text-sm relative ${
              recipient.id.toString() === activeCareRecipient
                ? "border-b-2 border-primary text-primary"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => onChangeRecipient(recipient.id.toString())}
          >
            {recipient.name}
          </Button>
        ))}
        <Button
          variant="ghost"
          className="py-2 px-1 text-sm text-gray-400 hover:text-primary"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
