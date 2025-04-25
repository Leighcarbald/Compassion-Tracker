import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { type CareRecipient } from "@shared/schema";
import { Plus, MoreVertical, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [recipientToDelete, setRecipientToDelete] = useState<CareRecipient | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/care-recipients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/care-recipients'] });
      
      // If the deleted recipient was active, select another one
      if (recipientToDelete && recipientToDelete.id.toString() === activeCareRecipient) {
        const otherRecipient = careRecipients.find(r => r.id !== recipientToDelete.id);
        if (otherRecipient) {
          onChangeRecipient(otherRecipient.id.toString());
        }
      }
      
      toast({
        title: "Care recipient removed",
        description: `${recipientToDelete?.name} has been removed from your care list.`,
        variant: "default",
      });
      
      setRecipientToDelete(null);
      setShowDeleteDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove care recipient. Please try again.",
        variant: "destructive",
      });
      setShowDeleteDialog(false);
    }
  });
  
  const handleDeleteClick = (recipient: CareRecipient, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent tab change
    setRecipientToDelete(recipient);
    setShowDeleteDialog(true);
  };
  
  const confirmDelete = () => {
    if (recipientToDelete) {
      deleteMutation.mutate(recipientToDelete.id);
    }
  };

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
    <>
      <div className="mt-3 border-b border-gray-200">
        <div className="flex space-x-6 overflow-x-auto pb-1 scrollbar-hide">
          {careRecipients.map((recipient) => (
            <div key={recipient.id} className="flex items-center">
              <Button
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
              
              {/* Delete button (only show for active recipient) */}
              {recipient.id.toString() === activeCareRecipient && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      className="text-red-500 focus:text-red-500"
                      onClick={(e) => handleDeleteClick(recipient, e as unknown as React.MouseEvent)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            className="py-2 px-1 text-sm text-gray-400 hover:text-primary"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Care Recipient</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {recipientToDelete?.name}? This action cannot be undone and will delete all associated data including medications, appointments, and health records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
