import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
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
    fetchEvents(selectedDate); // ✅ load on mount + when date changes

      const channel = supabase
        .channel("events")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "events" },
          () => fetchEvents(selectedDate) // realtime refresh
        )
        .subscribe();

      return () => {
        channel.unsubscribe(); // sync cleanup
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
    setForm({ title: "", description: "", start: "", end: "", all_day: false, location:  "" });
    fetchEvents(selectedDate);
  };


  const eventsOnSelected = useMemo(() => {
    if (!selectedDate) return [] as EventRow[];
    const day = selectedDate.toDateString();
    return events.filter((e) => new Date(e.start).toDateString() === day);
  }, [events, selectedDate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          <h2 className="text-xl font-bold">Calendar</h2>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button>New Event</Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Create Event</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs">Start</label>
                      <Input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs">End</label>
                      <Input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs">Location</label>
                    <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="allday" checked={form.all_day} onChange={(e) => setForm({ ...form, all_day: e.target.checked })} />
                    <label htmlFor="allday" className="text-sm">All day</label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
                    <Button onClick={createEvent}>Create</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4">
          <DayPicker mode="single" selected={selectedDate} onSelect={setSelectedDate} showOutsideDays />
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Events on selected day</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {eventsOnSelected.map((e) => (
              <div key={e.id} className="border rounded p-2">
                <div className="font-medium">{e.title}</div>
                {e.description ? <div className="text-sm text-muted-foreground">{e.description}</div> : null}
                <div className="text-xs">{new Date(e.start).toLocaleString()} — {new Date(e.end).toLocaleString()}</div>
                {e.location ? <div className="text-xs">{e.location}</div> : null}
              </div>
            ))}
            {!eventsOnSelected.length && <div className="text-sm text-muted-foreground">No events</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarPage;