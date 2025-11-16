import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Search,
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: "high" | "medium" | "low";
  status: "todo" | "in_progress" | "completed";
  completion_percentage: number;
  deadline: string | null;
  is_public: boolean;
  created_at: string;
  proof_of_work_url?: string | null;
  is_active?: boolean | null;
}

interface TaskListProps {
  userId: string;
}
interface BlogPost {
  id: string;
}
/**
 * TaskList
 * - All logic kept in single file (create, update, proof upload, pagination, filters)
 * - Querying server-side by status / public flag to scale with large datasets
 * - Subtle Tailwind animations added for engagement
 */
const TaskList = ({ userId }: TaskListProps) => {
  // UI / paging
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<
    "all" | "todo" | "in_progress" | "completed" | "public"
  >("all");

  // Create / edit / proof
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as const,
    deadline: "",
    is_public: false,
  });

  // helpers
  const [searchTerm, setSearchTerm] = useState("");
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

  // fetch user profile (points, active_tasks if you have)
  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("points, active_tasks, post_count")
        .eq("id", userId)
        .single();
      if (data) {
        setUserPoints(data.points ?? 0);
      }
    } catch (e) {
      // non-fatal
      // console.warn("profile fetch error", e);
    }
  }, [userId]);

  // core fetch tasks (server-side filter & search & pagination)
  const fetchTasks = useCallback(
    async (reset = false) => {
      // reset logic
      if (reset) {
        setPage(0);
        setHasMore(true);
      }
      if (loadingMore || (!hasMore && !reset)) return;

      setLoadingMore(true);
      if (reset) setLoadingInitial(true);

      const currentPage = reset ? 0 : page;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // build base query
      let query = supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      // apply server-side filter
      if (filter === "todo") {
        query = query.eq("status", "todo");
      } else if (filter === "in_progress") {
        query = query.eq("status", "in_progress");
      } else if (filter === "completed") {
        query = query.eq("status", "completed");
      } else if (filter === "public") {
        query = query.eq("is_public", true);
      } // 'all' -> no extra filter

      // always fetch only current user's tasks (DailyLogsList analogy you wanted user-specific)
      query = query.eq("user_id", userId);

      // add simple title/content search (server-side)
      if (searchTerm.trim()) {
        // using ilike for title; description search could be added similarly
        // Supabase .or with ilike for multiple columns: wrap properly
        const term = `%${searchTerm}%`;
        // apply OR filter across title and description
        query = query.or(`title.ilike.${term},description.ilike.${term}`);
      }

      const { data, error } = await query;

      setLoadingMore(false);
      setLoadingInitial(false);

      if (error) {
        toast.error("Failed to fetch tasks");
        return;
      }

      if (!data || data.length === 0) {
        if (reset) setTasks([]);
        setHasMore(false);
        return;
      }

      if (reset) setTasks(data as Task[]);
      else setTasks((prev) => [...prev, ...(data as Task[])]);

      setPage((p) => (reset ? 1 : p + 1));
      if ((data as Task[]).length < PAGE_SIZE) setHasMore(false);
    },
    [filter, page, PAGE_SIZE, searchTerm, userId, hasMore, loadingMore]
  );

  useEffect(() => {
    // initial
    (async () => {
      setLoadingInitial(true);
      await fetchProfile();
      await fetchTasks(true);
      setLoadingInitial(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, searchTerm, userId]);

  // create a new task + optionally create public post
  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    const { data: insertedTasks, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: newTask.title,
        description: newTask.description || null,
        priority: newTask.priority,
        deadline: newTask.deadline || null,
        is_public: newTask.is_public,
        status: "todo",
        completion_percentage: 0,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !insertedTasks) {
      toast.error("Failed to create task");
      return;
    }

    // if public, create community post (link back with task_id)
    if (newTask.is_public) {
      try {
        const { error: postError } = await supabase.from("blog_posts").insert({
          user_id: userId,
          title: newTask.title,
          content:
            newTask.description?.trim() ||
            "Started a new public accountability task 💪",
          task_id: insertedTasks.id,
          tags: ["accountability"],
        });

        if (postError) {
          console.error("Failed to create community post:", postError);
          toast.error("Couldn't share task to community");
        } else {
          toast.success("Task shared to community 🎉");
        }
      } catch (e) {
        console.error("Unexpected error while creating blog post:", e);
      }
    }

    toast.success("Task created successfully!");
    setIsDialogOpen(false);
    setNewTask({
      title: "",
      description: "",
      priority: "medium",
      deadline: "",
      is_public: false,
    });

    // reload first page
    setHasMore(true);
    setPage(0);
    await fetchTasks(true);
    await fetchProfile();
  };

  // update status (Start -> in_progress; we don't allow reverting past flow)
  const handleUpdateTaskStatus = async (taskId: string, newStatus: Task["status"]) => {
    const completionPercentage =
      newStatus === "completed" ? 100 : newStatus === "in_progress" ? 50 : 0;

    // disallow marking completed directly (without proof)
    if (newStatus === "completed") {
      toast.error("To mark as completed you must upload proof.");
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        completion_percentage: completionPercentage,
      })
      .eq("id", taskId);

    if (error) {
      toast.error("Failed to update task");
      return;
    }

    toast.success("Task updated!");
    setHasMore(true);
    setPage(0);
    await fetchTasks(true);
  };


  // delete
  
  const handleDeleteTask = async (taskId: string) => {
    const confirmDelete = window.confirm(
      "⚠️ Deleting this task will reduce your points by 5.\nAre you sure you want to continue?"
    );

    if (!confirmDelete) return;

    // delete the task
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      toast.error("Failed to delete task");
      return;
    }

    // reduce 5 points
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", userId)
        .single();

      if (!profileError && profile) {
        const newPoints = Math.max(0, (profile.points || 0) - 5);

        await supabase
          .from("profiles")
          .update({ points: newPoints })
          .eq("id", userId);

        setUserPoints(newPoints);
        toast.warning("Task deleted! -5 points ⚠️");
      } else {
        toast.success("Task deleted");
      }
    } catch (err) {
      toast.success("Task deleted");
    }

    // refresh
    setHasMore(true);
    setPage(0);
    await fetchTasks(true);
    await fetchProfile();
  };

  // handle proof upload -> mark completed -> award points -> decrement active_tasks -> create post if public

  const handleSubmitProof = async () => {
    if (isSubmittingProof) return; // prevent double-click
    setIsSubmittingProof(true);

    if (!proofFile || !selectedTaskId) {
      setIsSubmittingProof(false);
      toast.error("Please select a file first");
      return;
    }

    // ✅ File size validation (50 MB = 50 * 1024 * 1024 bytes)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (proofFile.size > MAX_FILE_SIZE) {
      toast.error("File size exceeds 50 MB. Please upload a smaller image or compress it.");
      setIsSubmittingProof(false);
      return;
    }

    try {
      // sanitize filename
      const sanitizedFileName = proofFile.name
        .replace(/\s+/g, "_")
        .replace(/[^\w.-]/g, "_");
      const filePath = `task-proofs/${userId}/${Date.now()}_${sanitizedFileName}`;

      // upload
      const { error: uploadError } = await supabase
        .storage
        .from("task-proofs")
        .upload(filePath, proofFile);

      if (uploadError) {
        toast.error(uploadError.message || "Failed to upload proof image");
        return;
      }

      // public url
      const { data: urlData } = supabase.storage
        .from("task-proofs")
        .getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl || null;

      // mark task completed
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          status: "completed",
          completion_percentage: 100,
          proof_of_work_url: publicUrl,
          is_active: false,
        })
        .eq("id", selectedTaskId);

      if (updateError) {
      toast.error("Failed to mark task as completed");
      return;
    }

    // Award points (+10)
    const { data: profile } = await supabase
      .from("profiles")
      .select("points, active_tasks")
      .eq("id", userId)
      .single();

    if (profile) {
      await supabase
        .from("profiles")
        .update({ points: (profile.points || 0) + 10 })
        .eq("id", userId);

      if (typeof profile.active_tasks === "number") {
        const newCount = Math.max(0, (profile.active_tasks || 0) - 1);
        await supabase
          .from("profiles")
          .update({ active_tasks: newCount })
          .eq("id", userId);
      }

      setUserPoints((prev) => (prev ?? 0) + 10);
    }

    // If task is public, handle community post
    const { data: taskRecord } = await supabase
      .from("tasks")
      .select("is_public, title, description")
      .eq("id", selectedTaskId)
      .single();

    if (taskRecord?.is_public) {
      const postContent = `${
        taskRecord.description || ""
      }\n\n✅ Task completed successfully! 🎯\n\n![Proof of Work]`;

      const { error: insertError } = await supabase.from("blog_posts").insert({
        user_id: userId,
        title: `✅ Completed: ${taskRecord.title || "A Task"}`,
        content: postContent,
        task_id: selectedTaskId,
        tags: ["accountability", "task-completion"],
        image_url: publicUrl,
      });

      if (insertError) {
        console.error("Error creating community post:", insertError);
      } else {
        toast.success("Posted your completion update to the community 🎉");
      }
    }
    
    toast.success("Task completed with proof! +10 points 🎉");

    // cleanup
    setProofDialogOpen(false);
    setProofFile(null);
    setSelectedTaskId(null);
    setHasMore(true);
    setPage(0);
    await fetchTasks(true);
    await fetchProfile();
  } catch (error) {
    console.error(error);
    toast.error("Something went wrong while submitting proof");
  } finally {
    setIsSubmittingProof(false);
  }
};


  // helpers for UI
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-warning text-warning-foreground";
      case "low":
        return "bg-success text-success-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-warning" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  // load more
  const loadMore = async () => {
    if (!hasMore) return;
    await fetchTasks();
  };

  // UI: small tab nav
  const TabButton = ({
    id,
    label,
  }: {
    id: typeof filter;
    label: string;
  }) => (
    <button
      onClick={() => {
        setFilter(id);
        setHasMore(true);
        setPage(0);
      }}
      className={`px-3 py-1 rounded-md transition-all ${
        filter === id
          ? "bg-primary text-white shadow-md transform -translate-y-0.5"
          : "bg-transparent text-muted-foreground hover:bg-muted/20"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            My Tasks
            <span className="text-sm text-muted-foreground ml-2 animate-pulse">
              {userPoints !== null ? `${userPoints} pts` : ""}
            </span>
          </h2>
          <p className="text-muted-foreground">Track and manage your daily goals</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title or description..."
              className="pl-10 pr-3 w-64"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                // reset and re-run search
                setHasMore(true);
                setPage(0);
                // fetchTasks(true) handled by effect because searchTerm is dependency
              }}
            />
          </div>

          {/* New Task */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex gap-2 items-center animate-bounce/60">
                <Plus className="h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newTask.title}
                    onChange={(e) =>
                      setNewTask((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="Write a concise title"
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newTask.description}
                    onChange={(e) =>
                      setNewTask((p) => ({ ...p, description: e.target.value }))
                    }
                    rows={4}
                    placeholder="Optional details..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Priority</Label>
                    <Select
                      value={newTask.priority}
                      onValueChange={(value) =>
                        setNewTask((p) => ({ ...p, priority: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Deadline</Label>
                    <Input
                      type="date"
                      value={newTask.deadline}
                      onChange={(e) =>
                        setNewTask((p) => ({ ...p, deadline: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="public"
                    type="checkbox"
                    className="rounded"
                    checked={newTask.is_public}
                    onChange={(e) =>
                      setNewTask((p) => ({ ...p, is_public: e.target.checked }))
                    }
                  />
                  <Label htmlFor="public">Make task public for accountability</Label>
                </div>

                <Button className="w-full" onClick={handleCreateTask}>
                  Create Task
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 items-center">
        <TabButton id="all" label="All" />
        <TabButton id="todo" label="To Do" />
        <TabButton id="in_progress" label="In Progress" />
        <TabButton id="completed" label="Completed" />
        <TabButton id="public" label="Public" />
      </div>

      {/* Tasks list */}
      <div className="grid gap-4">
        {tasks.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CheckCircle2 className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No tasks found</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Try a different search." : "Create your first task!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              className="shadow-card hover:shadow-primary transition-shadow"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(task.status)}
                      <CardTitle className="text-lg">{task.title}</CardTitle>
                      {task.is_public && (
                        <Badge className="ml-2 animate-pulse/60">Public</Badge>
                      )}
                    </div>
                    {task.description && (
                      <CardDescription>{task.description}</CardDescription>
                    )}
                  </div>

                  <Badge className={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{task.completion_percentage}%</span>
                  </div>
                  <Progress value={task.completion_percentage} />

                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      {/* Show appropriate controls based on status */}
                      {task.status === "todo" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleUpdateTaskStatus(task.id, "in_progress")
                          }
                        >
                          Start
                        </Button>
                      )}

                      {task.status === "in_progress" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            setProofDialogOpen(true);
                          }}
                        >
                          Mark Done
                        </Button>
                      )}

                      {task.status === "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="opacity-80 cursor-not-allowed"
                        >
                          ✅ Completed
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setTaskToDelete(task.id);
                              setDeleteDialogOpen(true);
                            }}
                            aria-label="Delete task"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>

                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Deleting this task will <b>reduce your points by 5</b>.  
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                              onClick={async () => {
                                if (taskToDelete) {
                                  await handleDeleteTask(taskToDelete);
                                }
                                setDeleteDialogOpen(false);
                                setTaskToDelete(null);
                              }}
                            >
                              Yes, Delete (-5 pts)
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* show proof preview if task completed */}
                  {task.status === "completed" && task.proof_of_work_url && (
                    <div className="mt-2">
                      <img
                        src={task.proof_of_work_url}
                        alt="Proof"
                        className="w-40 h-28 object-cover rounded-lg border"
                        onError={(e) =>
                          ((e.target as HTMLImageElement).style.display = "none")
                        }
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* pager / load more */}
      <div className="flex justify-center py-4">
        {loadingMore ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : hasMore ? (
          <Button onClick={loadMore}>Load more</Button>
        ) : (
          <p className="text-sm text-muted-foreground">No more tasks</p>
        )}
      </div>

      {/* Proof dialog */}
      <Dialog open={proofDialogOpen} onOpenChange={setProofDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Proof of Work</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
            />
            <div className="flex gap-2">
              <Button disabled={!proofFile || isSubmittingProof} onClick=     {handleSubmitProof}>
                {isSubmittingProof ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span> Uploading…
                  </>
                ) : (
                  "Submit Proof"
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setProofFile(null);
                  setSelectedTaskId(null);
                  setProofDialogOpen(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskList;
