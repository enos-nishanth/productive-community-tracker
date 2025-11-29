import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Megaphone, Pin, Plus, Image as ImageIcon, Loader2 } from "lucide-react";

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
  const [uploading, setUploading] = useState(false);

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
    setUploading(true);
    let imageUrl: string | null = null;
    if (image) imageUrl = await uploadImage();
    
    const { error } = await supabase.from("announcements").insert({
      user_id: userId,
      title: form.title.trim(),
      content: form.content.trim(),
      image_url: imageUrl,
      pinned: form.pinned,
    });
    
    setUploading(false);
    
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
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
             <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Announcements</h2>
            <p className="text-sm text-muted-foreground">Latest updates and news</p>
          </div>
        </div>
        
        {isAdmin && (
          <Dialog open={openCompose} onOpenChange={setOpenCompose}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Post
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Announcement</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input 
                    placeholder="Announcement Title" 
                    value={form.title} 
                    onChange={(e) => setForm({ ...form, title: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea 
                    placeholder="What's happening?" 
                    value={form.content} 
                    onChange={(e) => setForm({ ...form, content: e.target.value })} 
                    className="min-h-[120px]" 
                  />
                </div>
                <div className="space-y-2">
                    <Label>Attachment</Label>
                    <div className="flex items-center gap-2">
                        <Input 
                            type="file" 
                            accept="image/*" 
                            className="cursor-pointer"
                            onChange={(e) => setImage(e.target.files?.[0] || null)} 
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="pinned" 
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                    checked={form.pinned} 
                    onChange={(e) => setForm({ ...form, pinned: e.target.checked })} 
                  />
                  <Label htmlFor="pinned" className="font-normal cursor-pointer">Pin to top</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenCompose(false)}>Cancel</Button>
                <Button onClick={submit} disabled={uploading}>
                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Post Announcement
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-6">
        {ordered.map((a) => (
          <Card key={a.id} className={`overflow-hidden transition-all duration-200 ${a.pinned ? 'border-primary/50 bg-primary/5 shadow-md' : 'hover:shadow-md'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <CardTitle className="text-xl leading-none">{a.title}</CardTitle>
                    <CardDescription>
                        {new Date(a.created_at || "").toLocaleDateString(undefined, { dateStyle: 'long' })}
                    </CardDescription>
                </div>
                {a.pinned && (
                  <Badge variant="default" className="flex items-center gap-1 shrink-0">
                    <Pin className="h-3 w-3" />
                    Pinned
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {a.image_url && (
                <div className="rounded-md overflow-hidden border bg-muted">
                    <img 
                        src={a.image_url} 
                        alt="announcement" 
                        className="w-full h-auto max-h-[400px] object-cover" 
                    />
                </div>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {a.content}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {!ordered.length && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 border-2 border-dashed rounded-xl">
             <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center">
                <Megaphone className="h-6 w-6 text-muted-foreground" />
             </div>
             <div className="text-muted-foreground">No announcements yet</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Announcements;