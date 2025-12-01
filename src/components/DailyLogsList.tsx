import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, BookOpen, Trash2, Search, Image as ImageIcon, Video, Loader2, X, Calendar, Smile } from "lucide-react";
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
  
  // New state for viewing a specific log
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null);

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

  const fetchLogs = useCallback(async () => {
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
  }, [userId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleCreateLog = async () => {
    if (isPublishing) return;
    setIsPublishing(true);

    if (!newLog.title.trim() || !newLog.content.trim()) {
      toast.error("Please fill in title and content");
      setIsPublishing(false);
      return;
    }

    let fileUrl = null;

    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error("File size exceeds 50MB");
        setIsPublishing(false);
        return;
      }

      let uploadFile = file;

      if (file.type.startsWith("video/")) {
        try {
          toast.info("Compressing video before upload...");
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

    // 1️⃣ Create the daily log
    const { error: logError } = await supabase
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

    // 2️⃣ If “Share with community” is checked, post to blog_posts
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

    // 3️⃣ Update user's post count in `profiles`
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
    const confirmDelete = window.confirm("Are you sure you want to delete this log?");
    if (!confirmDelete) return;
    
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    if (f) {
      // Create preview for image files
      if (f.type.startsWith("image/")) {
        setPreview(URL.createObjectURL(f));
      } else if (f.type.startsWith("video/")) {
        // Handle video preview (often shows a standard video icon)
        setPreview("video-placeholder"); // Custom marker for video
      } else {
        setPreview(null);
      }
    } else {
      setPreview(null);
    }
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* --- Header & Actions --- */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 py-4 border-b">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> My Daily Journal
          </h2>
          <p className="text-muted-foreground mt-1">
            Capture your thoughts, progress, and memories.
          </p>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title, tags, or mood..."
              className="pl-9 h-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* New Log Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-10 w-auto flex-shrink-0">
                <Plus className="h-4 w-4" />
                New Log
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Daily Log 📝</DialogTitle>
                <DialogDescription>
                  Record your daily activities, set a mood, and reflect.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="space-y-2">
                  <Label htmlFor="log-title">Title</Label>
                  <Input
                    id="log-title"
                    value={newLog.title}
                    onChange={(e) => setNewLog({ ...newLog, title: e.target.value })}
                    placeholder="E.g., Finished the design sprint"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="log-content">What happened today?</Label>
                  <Textarea
                    id="log-content"
                    value={newLog.content}
                    onChange={(e) => setNewLog({ ...newLog, content: e.target.value })}
                    placeholder="Write about your day, challenges, and successes..."
                    rows={8}
                    className="min-h-[150px] resize-y"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="log-tags">Tags (comma-separated)</Label>
                    <Input
                      id="log-tags"
                      value={newLog.tags}
                      onChange={(e) => setNewLog({ ...newLog, tags: e.target.value })}
                      placeholder="e.g., #productivity, #reading"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="log-mood">Mood</Label>
                    <Input
                      id="log-mood"
                      value={newLog.mood}
                      onChange={(e) => setNewLog({ ...newLog, mood: e.target.value })}
                      placeholder="e.g., 😊 Happy, 🤔 Reflective"
                    />
                  </div>
                </div>

                {/* File Attachment Section */}
                <div className="space-y-2 pt-2">
                  <Label htmlFor="log-file">Media Attachment (optional)</Label>
                  <Input
                    id="log-file"
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                  />

                  {/* Enhanced Preview */}
                  {file && (
                    <div className="mt-4 relative p-3 border rounded-lg bg-muted/30">
                      {preview === "video-placeholder" ? (
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Video className="h-5 w-5" />
                          <span>Video selected: **{file.name}** (will be compressed)</span>
                        </div>
                      ) : preview ? (
                        <div className="relative">
                          <img
                            src={preview}
                            alt="Image Preview"
                            className="w-full max-h-64 object-contain rounded-md border"
                          />
                        </div>
                      ) : null}
                      
                      {/* Clear Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 rounded-full text-destructive hover:bg-destructive/10"
                        onClick={() => {
                            setFile(null);
                            setPreview(null);
                            const fileInput = document.getElementById("log-file") as HTMLInputElement;
                            if (fileInput) fileInput.value = "";
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <input
                    type="checkbox"
                    id="log-public"
                    checked={newLog.is_public}
                    onChange={(e) =>
                      setNewLog({ ...newLog, is_public: e.target.checked })
                    }
                    className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <Label htmlFor="log-public" className="text-sm font-medium cursor-pointer">
                    Share with community (Post to Blog Feed)
                  </Label>
                </div>

                <Button onClick={handleCreateLog} className="w-full h-10 gap-2" disabled={isPublishing}>
                  {isPublishing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Save & Log"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* --- Logs Display --- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredLogs.length === 0 ? (
          <Card className="col-span-full border-dashed shadow-none bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-12 w-12 text-primary/70 mb-4" />
              <p className="text-lg font-semibold">
                {searchTerm ? "No logs matching your search." : "Your journal is empty."}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Click **New Log** to start documenting your daily journey!
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredLogs.map((log) => (
            <Card key={log.id} className="shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col">
              <CardHeader className="pb-3 border-b border-dashed">
                <div className="flex justify-between items-start">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold truncate hover:whitespace-normal">
                        {log.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CardDescription className="text-xs">
                          {format(new Date(log.created_at), "MMM d, yyyy")}
                        </CardDescription>
                        {log.mood && <Badge variant="outline" className="text-xs font-normal px-2 py-0.5">{log.mood}</Badge>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/80 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteLog(log.id, log.user_id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1 flex flex-col justify-between">
                <div>
                    <p className="text-sm text-foreground/80 line-clamp-3 mb-1">{log.content}</p>
                    
                    {/* --- READ MORE BUTTON --- */}
                    <Button 
                        variant="link" 
                        className="p-0 h-auto font-semibold text-primary mb-3" 
                        onClick={() => setSelectedLog(log)}
                    >
                        Read more
                    </Button>

                    {/* Media Preview (Smaller for card view) */}
                    {log.image_url && (
                        <div className="mb-3 rounded-md overflow-hidden bg-muted cursor-pointer" onClick={() => setSelectedLog(log)}>
                            {log.image_url.match(/\.(mp4|webm|ogg)$/i) ? (
                                <video src={log.image_url} className="w-full h-24 object-cover" />
                            ) : (
                                <img src={log.image_url} alt="Log media" className="w-full h-24 object-cover" />
                            )}
                        </div>
                    )}
                </div>

                {log.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t">
                    {log.tags.map((tag, index) => (
                      <Badge key={index} variant="default" className="text-[10px] font-medium px-2 py-0.5 bg-primary/10 text-primary hover:bg-primary/20">
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

      {/* --- View Detail Dialog --- */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {selectedLog && (
                <>
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold leading-tight mr-4">
                            {selectedLog.title}
                        </DialogTitle>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                             <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(selectedLog.created_at), "MMMM d, yyyy 'at' h:mm a")}
                             </div>
                             {selectedLog.mood && (
                                 <div className="flex items-center gap-1">
                                    <Smile className="h-4 w-4" />
                                    <span>{selectedLog.mood}</span>
                                 </div>
                             )}
                        </div>
                    </DialogHeader>

                    <div className="mt-4 space-y-6">
                        {/* Media Display - Full Size */}
                        {selectedLog.image_url && (
                            <div className="rounded-xl overflow-hidden border bg-black/5">
                                {selectedLog.image_url.match(/\.(mp4|webm|ogg)$/i) ? (
                                    <video src={selectedLog.image_url} controls className="w-full max-h-[500px] mx-auto object-contain" />
                                ) : (
                                    <img src={selectedLog.image_url} alt="Log Attachment" className="w-full max-h-[500px] mx-auto object-contain" />
                                )}
                            </div>
                        )}

                        {/* Full Content */}
                        <div className="prose prose-sm sm:prose-base max-w-none text-foreground whitespace-pre-wrap leading-relaxed">
                            {selectedLog.content}
                        </div>

                        {/* Tags */}
                        {selectedLog.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-4 border-t">
                                {selectedLog.tags.map((tag, index) => (
                                    <Badge key={index} variant="secondary">
                                        #{tag}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default DailyLogsList;