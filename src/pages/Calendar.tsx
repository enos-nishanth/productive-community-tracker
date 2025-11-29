import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CalendarDays, MapPin, Clock, Calendar as CalendarIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  all_day: boolean | null;
  location: string | null;
  created_by: string | null;
  google_event_id: string | null;
};

const CalendarPage = ({ userId }: { userId: string }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", start: "", end: "", all_day: false, location: "" });

  useEffect(() => {
    const checkRole = async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle();
      setIsAdmin(data?.role === "admin");
    };
    checkRole();
  }, [userId]);

  const rangeForMonth = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start: start.toISOString(), end: new Date(end.getTime() + 24 * 60 * 60 * 1000).toISOString() };
  };

  const fetchEvents = async (anchor: Date | undefined) => {
    const base = anchor || new Date();
    const { start, end } = rangeForMonth(base);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .gte("start", start)
      .lt("end", end)
      .order("start", { ascending: true });
    if (error) return;
    setEvents((data || []) as EventRow[]);
  };

  useEffect(() => {
    fetchEvents(selectedDate);

    const channel = supabase
      .channel("events")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => fetchEvents(selectedDate)
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedDate]);

  const createEvent = async () => {
    if (!form.title.trim()) {
      toast.error("Enter title");
      return;
    }

    const startIso = form.start;
    const endIso = form.end;

    const { data, error } = await supabase.from("events").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      start: startIso,
      end: endIso,
      all_day: form.all_day,
      location: form.location.trim() || null,
      created_by: userId,
    }).select("*").single();

    if (error) {
      toast.error("Failed to create event");
      return;
    }

    toast.success("Event created");
    setOpenCreate(false);
    setForm({ title: "", description: "", start: "", end: "", all_day: false, location: "" });
    fetchEvents(selectedDate);
  };

  const eventsOnSelected = useMemo(() => {
    if (!selectedDate) return [] as EventRow[];
    const day = selectedDate.toDateString();
    return events.filter((e) => new Date(e.start).toDateString() === day);
  }, [events, selectedDate]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
            <p className="text-sm text-muted-foreground">Manage your schedule and events</p>
          </div>
        </div>

        {isAdmin && (
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                New Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Event Title</Label>
                  <Input 
                    placeholder="e.g., Team Meeting" 
                    value={form.title} 
                    onChange={(e) => setForm({ ...form, title: e.target.value })} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input 
                      type="datetime-local" 
                      value={form.start} 
                      onChange={(e) => setForm({ ...form, start: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input 
                      type="datetime-local" 
                      value={form.end} 
                      onChange={(e) => setForm({ ...form, end: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                    <Label>Location</Label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                            className="pl-9"
                            placeholder="Add a location" 
                            value={form.location} 
                            onChange={(e) => setForm({ ...form, location: e.target.value })} 
                        />
                    </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="Add details about the event..." 
                    value={form.description} 
                    onChange={(e) => setForm({ ...form, description: e.target.value })} 
                    className="resize-none"
                    rows={3} 
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="allday" 
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                    checked={form.all_day} 
                    onChange={(e) => setForm({ ...form, all_day: e.target.checked })} 
                  />
                  <Label htmlFor="allday" className="cursor-pointer font-normal">All day event</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
                <Button onClick={createEvent}>Create Event</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Sidebar: Calendar Picker */}
        <div className="md:col-span-4 lg:col-span-3">
            <Card className="h-fit sticky top-6 overflow-hidden">
                <CardContent className="p-0 flex justify-center py-4">
                    <DayPicker 
                        mode="single" 
                        selected={selectedDate} 
                        onSelect={setSelectedDate} 
                        showOutsideDays
                        className="p-3 bg-background rounded-lg"
                        // 1. FIX: Reduced cell size to 32px to fit in smaller columns
                        // 2. FIX: Added accent color variable to match your theme
                        style={{
                            width: '100%',
                            "--rdp-cell-size": "32px",
                            "--rdp-accent-color": "hsl(var(--primary))",
                            "--rdp-background-color": "hsl(var(--primary)/0.1)",
                        } as React.CSSProperties}
                    />
                </CardContent>
            </Card>
        </div>

        {/* Main Content: Event List */}
        <div className="md:col-span-8 lg:col-span-9">
          <Card className="min-h-[500px] flex flex-col">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-lg">
                        {selectedDate ? selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a date'}
                    </CardTitle>
                    <CardDescription>
                        {eventsOnSelected.length} {eventsOnSelected.length === 1 ? 'event' : 'events'} scheduled
                    </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-6">
              <div className="space-y-4">
                {eventsOnSelected.length > 0 ? (
                    eventsOnSelected.map((e) => (
                    <div key={e.id} className="group flex flex-col sm:flex-row gap-4 p-4 border rounded-xl hover:bg-muted/40 transition-colors shadow-sm bg-card text-card-foreground">
                        <div className="min-w-[100px] flex sm:flex-col gap-2 sm:gap-1 text-sm text-muted-foreground border-b sm:border-b-0 sm:border-r border-border pb-2 sm:pb-0 sm:pr-4">
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                <span className="font-medium text-foreground">{formatTime(e.start)}</span>
                            </div>
                            <span className="text-xs">{formatTime(e.end)}</span>
                        </div>
                        
                        <div className="space-y-1.5 flex-1">
                            <div className="flex items-start justify-between">
                                <h4 className="font-semibold text-base leading-none text-foreground">{e.title}</h4>
                                {e.all_day && <span className="text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">All Day</span>}
                            </div>
                            
                            {e.description && <p className="text-sm text-muted-foreground line-clamp-2">{e.description}</p>}
                            
                            {e.location && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    <span>{e.location}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                            <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <div>
                            <p className="text-lg font-medium text-foreground">No events scheduled</p>
                            <p className="text-sm text-muted-foreground">Select another day or create a new event.</p>
                        </div>
                        {isAdmin && (
                             <Button variant="outline" onClick={() => setOpenCreate(true)} className="mt-2">
                                Add Event
                             </Button>
                        )}
                    </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;