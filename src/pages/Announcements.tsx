import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Megaphone, Pin } from "lucide-react";

type Announcement = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  image_url: string | null;
  pinned: boolean | null;
  created_at: string | null;
};

const Announcements = ({ userId }: { userId: string }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [openCompose, setOpenCompose] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", pinned: false });
  const [image, setImage] = useState<File | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle();
      setIsAdmin(data?.role === "admin");
    };
    checkRole();
  }, [userId]);

  const fetchItems = async () => {
    const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    if (error) return;
    setItems((data || []) as Announcement[]);
  };

  useEffect(() => {
    fetchItems();
    const chan = supabase
      .channel("announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => fetchItems())
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
    };
  }, []);

  const uploadImage = async () => {
    if (!image) return null;
    const sanitized = image.name.replace(/\s+/g, "_").replace(/[^\w.-]/g, "_");
    const path = `announcements/${Date.now()}_${sanitized}`;
    const { data, error } = await supabase.storage.from("post-images").upload(path, image);
    if (error) return null;
    const { data: url } = supabase.storage.from("post-images").getPublicUrl(data.path);
    return url?.publicUrl || null;
  };

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Enter title and content");
      return;
    }
    let imageUrl: string | null = null;
    if (image) imageUrl = await uploadImage();
    const { error } = await supabase.from("announcements").insert({
      user_id: userId,
      title: form.title.trim(),
      content: form.content.trim(),
      image_url: imageUrl,
      pinned: form.pinned,
    });
    if (error) {
      toast.error("Failed to post announcement");
      return;
    }
    toast.success("Announcement posted");
    setOpenCompose(false);
    setForm({ title: "", content: "", pinned: false });
    setImage(null);
    fetchItems();
  };

  const ordered = useMemo(() => {
    const pinned = items.filter((i) => i.pinned);
    const rest = items.filter((i) => !i.pinned);
    return [...pinned, ...rest];
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          <h2 className="text-xl font-bold">Announcements</h2>
        </div>
      </div>

      <div className="grid gap-4">
        {ordered.map((a) => (
          <Card key={a.id} className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{a.title}</CardTitle>
                {a.pinned ? (
                  <Badge variant="secondary" className="flex items-center gap-1"><Pin className="h-3 w-3" />Pinned</Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {a.image_url ? <img src={a.image_url} alt="announcement" className="rounded-lg max-h-64 object-cover" /> : null}
                <p className="text-sm whitespace-pre-wrap">{a.content}</p>
                <div className="text-xs text-muted-foreground">{a.created_at}</div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!ordered.length && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No announcements</CardContent></Card>
        )}
      </div>
    </div>
  );
};

export default Announcements;