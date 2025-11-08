import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, BookOpen, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { compressVideo } from "@/lib/compressVideo";

interface DailyLog {
  id: string;
  title: string;
  content: string;
  tags: string[];
  mood: string | null;
  is_public: boolean;
  created_at: string;
  image_url?: string | null;
  user_id: string;
}

interface DailyLogsListProps {
  userId: string;
}

const DailyLogsList = ({ userId }: DailyLogsListProps) => {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLog, setNewLog] = useState({
    title: "",
    content: "",
    tags: "",
    mood: "",
    is_public: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLogs();
  }, [userId]);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch logs");
      return;
    }

    setLogs(data || []);
  };

  const handleCreateLog = async () => {
    if (isPublishing) return;
    setIsPublishing(true);

    if (!newLog.title.trim() || !newLog.content.trim()) {
      toast.error("Please fill in title and content");
      setIsPublishing(false);
      return;
    }

    let fileUrl = null;

    // ✅ File size + upload handling
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error("File size exceeds 50MB");
        setIsPublishing(false);
        return;
      }

      let uploadFile = file;

      if (file.type.startsWith("video/")) {
        try {
          uploadFile = await compressVideo(file);
        } catch {
          toast.error("Video compression failed");
        }
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(`dailylogs/${Date.now()}_${uploadFile.name}`, uploadFile);

      if (uploadError) {
        toast.error("Failed to upload file");
        setIsPublishing(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("post-images")
        .getPublicUrl(uploadData.path);

      fileUrl = urlData?.publicUrl || null;
    }

    const tags = newLog.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    // ✅ 1️⃣ Create the daily log
    const { data: insertedLog, error: logError } = await supabase
      .from("daily_logs")
      .insert({
        user_id: userId,
        title: newLog.title,
        content: newLog.content,
        tags,
        mood: newLog.mood || null,
        is_public: newLog.is_public,
        image_url: fileUrl,
      })
      .select()
      .single();

    if (logError) {
      toast.error("Failed to create log");
      setIsPublishing(false);
      return;
    }

    // ✅ 2️⃣ If “Share with community” is checked, post to blog_posts
    if (newLog.is_public) {
      const { error: blogError } = await supabase.from("blog_posts").insert({
        user_id: userId,
        title: newLog.title,
        content: newLog.content,
        tags,
        image_url: fileUrl,
      });

      if (blogError) {
        console.error(blogError);
        toast.error("Posted privately — failed to share with community");
      }
    }

    // ✅ 3️⃣ Update user's post count in `profiles`
    const { error: countError } = await supabase.rpc("increment_post_count", {
      user_id_input: userId,
    });

    if (countError) {
      console.error(countError);
    }

    toast.success("Daily log created!");
    setIsDialogOpen(false);
    setNewLog({ title: "", content: "", tags: "", mood: "", is_public: false });
    setFile(null);
    setPreview(null);
    fetchLogs();
    setIsPublishing(false);
  };

  const handleDeleteLog = async (logId: string, userId: string) => {
    // 1️⃣ Delete the log
    const { error: deleteError } = await supabase
      .from("daily_logs")
      .delete()
      .eq("id", logId);

    if (deleteError) {
      toast.error("Failed to delete log");
      return;
    }

    // 2️⃣ Decrement the user's post count
    const { error: decrementError } = await supabase.rpc("decrement_post_count", {
      user_id_input: userId,
    });

    if (decrementError) {
      console.error("Failed to update post count:", decrementError.message);
    }

    // 3️⃣ Refresh logs and show success
    toast.success("Log deleted successfully");
    fetchLogs();
  };


  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      log.title.toLowerCase().includes(term) ||
      log.content.toLowerCase().includes(term) ||
      log.tags.some((tag) => tag.toLowerCase().includes(term)) ||
      (log.mood?.toLowerCase().includes(term) ?? false)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">My Daily Logs</h2>
          <p className="text-muted-foreground">Document your daily journey and progress</p>
        </div>

        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your logs..."
              className="pl-8 w-56"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Log
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Daily Log</DialogTitle>
                <DialogDescription>Record your daily activities and thoughts</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="log-title">Title</Label>
                  <Input
                    id="log-title"
                    value={newLog.title}
                    onChange={(e) => setNewLog({ ...newLog, title: e.target.value })}
                    placeholder="Today's achievements"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="log-content">Content</Label>
                  <Textarea
                    id="log-content"
                    value={newLog.content}
                    onChange={(e) => setNewLog({ ...newLog, content: e.target.value })}
                    placeholder="Write about your day..."
                    rows={6}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="log-tags">Tags (comma-separated)</Label>
                    <Input
                      id="log-tags"
                      value={newLog.tags}
                      onChange={(e) => setNewLog({ ...newLog, tags: e.target.value })}
                      placeholder="Coding, Health, Learning"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="log-mood">Mood</Label>
                    <Input
                      id="log-mood"
                      value={newLog.mood}
                      onChange={(e) => setNewLog({ ...newLog, mood: e.target.value })}
                      placeholder="😊 Happy, 💪 Motivated"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="log-file">Attach Image/Video (optional)</Label>
                  <Input
                    id="log-file"
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setFile(f || null);
                      if (f && f.type.startsWith("image/")) {
                        setPreview(URL.createObjectURL(f));
                      } else {
                        setPreview(null);
                      }
                    }}
                  />
                  {preview && <img src={preview} alt="Preview" className="w-full rounded-lg mt-2" />}
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="log-public"
                    checked={newLog.is_public}
                    onChange={(e) => setNewLog({ ...newLog, is_public: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="log-public">Share with community</Label>
                </div>

                <Button onClick={handleCreateLog} className="w-full" disabled={isPublishing}>
                  {isPublishing ? "Posting..." : "Create Log"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredLogs.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No logs found</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Try a different search." : "Start documenting your daily journey!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredLogs.map((log) => (
            <Card key={log.id} className="shadow-card hover:shadow-primary transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{log.title}</CardTitle>
                      {log.mood && <span className="text-xl">{log.mood}</span>}
                    </div>
                    <CardDescription>
                      {format(new Date(log.created_at), "MMMM d, yyyy 'at' h:mm a")}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteLog(log.id, log.user_id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap mb-4">{log.content}</p>
                {log.image_url && (
                  <>
                    {log.image_url.endsWith(".mp4") ? (
                      <video src={log.image_url} controls className="w-full rounded-lg mb-4" />
                    ) : (
                      <img src={log.image_url} alt="Log media" className="w-full rounded-lg mb-4" />
                    )}
                  </>
                )}
                {log.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {log.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default DailyLogsList;
