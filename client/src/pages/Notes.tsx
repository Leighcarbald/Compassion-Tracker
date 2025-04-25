import { useState } from "react";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CareRecipient, Note, insertNoteSchema } from "@shared/schema";
import { TabType } from "@/lib/types";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Search, Plus, StickyNote } from "lucide-react";

interface NotesProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function Notes({ activeTab, setActiveTab }: NotesProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeCareRecipient, setActiveCareRecipient] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch care recipients
  const { data: careRecipients, isLoading: isLoadingRecipients } = useQuery<CareRecipient[]>({
    queryKey: ['/api/care-recipients'],
  });

  // Set default active recipient if none selected
  if (!activeCareRecipient && careRecipients && careRecipients.length > 0) {
    setActiveCareRecipient(String(careRecipients[0].id));
  }

  // Fetch notes
  const { data: notes, isLoading: isLoadingNotes } = useQuery<Note[]>({
    queryKey: ['/api/notes', activeCareRecipient],
    enabled: !!activeCareRecipient,
  });

  // Filter notes based on search query
  const filteredNotes = notes?.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle recipient change
  const handleChangeRecipient = (id: string) => {
    setActiveCareRecipient(id);
  };

  // Add note form
  const form = useForm({
    resolver: zodResolver(insertNoteSchema),
    defaultValues: {
      title: "",
      content: "",
      careRecipientId: 0
    }
  });

  // Create note mutation
  const createNote = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/notes', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes', activeCareRecipient] });
      setIsDialogOpen(false);
      form.reset();
    }
  });

  // Handle form submission
  const onSubmit = (data: any) => {
    if (activeCareRecipient) {
      createNote.mutate({
        ...data,
        careRecipientId: parseInt(activeCareRecipient)
      });
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
            <h2 className="text-lg font-semibold">Notes</h2>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-primary" 
              onClick={() => setIsDialogOpen(true)}
            >
              Add Note <Plus className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search notes..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Notes List */}
          <div className="space-y-3">
            {isLoadingNotes ? (
              <div className="text-center p-8 text-gray-500">Loading notes...</div>
            ) : !filteredNotes || filteredNotes.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  {searchQuery ? (
                    <p className="text-gray-500">No notes match your search</p>
                  ) : (
                    <>
                      <StickyNote className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                      <p className="text-gray-500">No notes yet</p>
                      <Button 
                        variant="outline" 
                        className="mt-4 text-primary" 
                        onClick={() => setIsDialogOpen(true)}
                      >
                        Create your first note
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredNotes.map((note) => (
                <Card key={note.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-3">
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium">{note.title}</div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(note.createdAt), "MMM d, h:mm a")}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-line">
                        {note.content.length > 150 
                          ? `${note.content.substring(0, 150)}...` 
                          : note.content}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>
      </main>
      
      <BottomNavigation 
        activeTab={activeTab} 
        onChangeTab={setActiveTab}
        onAddEvent={() => setIsDialogOpen(true)}
      />

      {/* Add Note Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea 
                        placeholder="Write your observations here..." 
                        className="min-h-[150px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createNote.isPending}
                >
                  {createNote.isPending ? "Saving..." : "Save Note"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
