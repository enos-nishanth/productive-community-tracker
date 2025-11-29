import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
 * - UI Updated for modern aesthetic
 * - Logic preserved
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
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  type Priority = "high" | "medium" | "low";

  const [newTask, setNewTask] = useState<{
    title: string;
    description: string;
    priority: Priority;
    deadline: string;
    is_public: boolean;
  }>({
    title: "",
    description: "",
    priority: "medium",
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

      // always fetch only current user's tasks
      query = query.eq("user_id", userId);

      // add simple title/content search (server-side)
      if (searchTerm.trim()) {
        const term = `%${searchTerm}%`;
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
    if (isCreatingTask) return; // prevent double click
    setIsCreatingTask(true);

    if (!newTask.title.trim()) {
      toast.error("Please enter a task title");
      setIsCreatingTask(false);
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
      setIsCreatingTask(false);
      return;
    }

    toast.success("Task created!");

    setIsCreatingTask(false);
    setIsDialogOpen(false);

    // if public, create community post
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

  // update status
  const handleUpdateTaskStatus = async (
    taskId: string,
    newStatus: Task["status"]
  ) => {
    const completionPercentage =
      newStatus === "completed" ? 100 : newStatus === "in_progress" ? 50 : 0;

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

  // handle proof upload
  const handleSubmitProof = async () => {
    if (isSubmittingProof) return; // prevent double-click
    setIsSubmittingProof(true);

    if (!proofFile || !selectedTaskId) {
      setIsSubmittingProof(false);
      toast.error("Please select a file first");
      return;
    }

    // ✅ File size validation
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (proofFile.size > MAX_FILE_SIZE) {
      toast.error(
        "File size exceeds 50 MB. Please upload a smaller image or compress it."
      );
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
      const { error: uploadError } = await supabase.storage
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

  // Helpers for UI
  const getPriorityBorderColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-destructive"; // Red
      case "medium":
        return "border-l-yellow-500"; // Yellow
      case "low":
        return "border-l-green-500"; // Green
      default:
        return "border-l-muted";
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "secondary"; // Often yellow/orange in themes or just distinct
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // load more
  const loadMore = async () => {
    if (!hasMore) return;
    await fetchTasks();
  };

  // UI: Pill Tab Nav
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
      className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
        filter === id
          ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/10"
          : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            My Tasks
            {userPoints !== null && (
              <Badge variant="secondary" className="ml-2 text-base px-3 py-0.5 rounded-full font-semibold">
                {userPoints} pts
              </Badge>
            )}
          </h2>
          <p className="text-muted-foreground">
            Track, manage, and prove your daily accomplishments.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              className="pl-9 bg-background/50 border-muted-foreground/20 focus:border-primary"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHasMore(true);
                setPage(0);
              }}
            />
          </div>

          {/* New Task Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-md hover:shadow-lg transition-all">
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Task Title</Label>
                  <Input
                    id="title"
                    value={newTask.title}
                    onChange={(e) =>
                      setNewTask((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="e.g. Finish Monthly Report"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea
                    id="desc"
                    value={newTask.description}
                    onChange={(e) =>
                      setNewTask((p) => ({ ...p, description: e.target.value }))
                    }
                    rows={3}
                    placeholder="Add details about your task..."
                    className="resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <Select
                      value={newTask.priority}
                      onValueChange={(value) =>
                        setNewTask((p) => ({
                          ...p,
                          priority: value as "high" | "medium" | "low",
                        }))
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

                  <div className="grid gap-2">
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

                <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-lg border border-dashed border-muted-foreground/30">
                  <input
                    id="public"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={newTask.is_public}
                    onChange={(e) =>
                      setNewTask((p) => ({ ...p, is_public: e.target.checked }))
                    }
                  />
                  <div className="space-y-1 leading-none">
                    <Label htmlFor="public" className="cursor-pointer">
                      Make task public
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Share this task with the community for accountability.
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full mt-2"
                  disabled={isCreatingTask}
                  onClick={handleCreateTask}
                >
                  {isCreatingTask ? "Creating..." : "Create Task"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 items-center bg-muted/20 p-1.5 rounded-full w-fit">
        <TabButton id="all" label="All" />
        <TabButton id="todo" label="To Do" />
        <TabButton id="in_progress" label="In Progress" />
        <TabButton id="completed" label="Done" />
        <TabButton id="public" label="Public" />
      </div>

      {/* Tasks Grid */}
      <div className="grid gap-5">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-xl bg-muted/10">
            <div className="bg-muted p-4 rounded-full mb-4">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No tasks found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              {searchTerm
                ? "Try adjusting your search criteria."
                : "You're all caught up! Create a new task to get started."}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg border-l-4 ${getPriorityBorderColor(
                task.priority
              )}`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusIcon(task.status)}
                      <CardTitle className="text-lg font-semibold leading-none">
                        {task.title}
                      </CardTitle>
                      {task.is_public && (
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wider h-5"
                        >
                          Public
                        </Badge>
                      )}
                    </div>
                    {task.description && (
                      <CardDescription className="line-clamp-2 text-sm leading-relaxed">
                        {task.description}
                      </CardDescription>
                    )}
                    {task.deadline && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" /> Due: {new Date(task.deadline).toLocaleDateString()}
                        </div>
                    )}
                  </div>

                  <Badge
                    variant={getPriorityBadgeColor(task.priority) as any}
                    className="capitalize shrink-0"
                  >
                    {task.priority}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pb-3">
                {/* Proof Image Preview */}
                {task.status === "completed" && task.proof_of_work_url && (
                  <div className="mb-4 mt-1">
                    <div className="relative group/image w-fit">
                      <img
                        src={task.proof_of_work_url}
                        alt="Proof"
                        className="w-32 h-24 object-cover rounded-md border shadow-sm transition-transform hover:scale-105"
                        onError={(e) =>
                          ((e.target as HTMLImageElement).style.display =
                            "none")
                        }
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity rounded-md flex items-center justify-center pointer-events-none">
                         <span className="text-white text-xs font-medium">Proof</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between text-xs font-medium text-muted-foreground">
                    <span>Progress</span>
                    <span>{task.completion_percentage}%</span>
                  </div>
                  <Progress value={task.completion_percentage} className="h-2" />
                </div>
              </CardContent>

              <CardFooter className="pt-3 border-t bg-muted/5 flex justify-between items-center">
                <div className="flex gap-2">
                  {task.status === "todo" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        handleUpdateTaskStatus(task.id, "in_progress")
                      }
                    >
                      Start Task
                    </Button>
                  )}

                  {task.status === "in_progress" && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedTaskId(task.id);
                        setProofDialogOpen(true);
                      }}
                      className="gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark Done
                    </Button>
                  )}

                  {task.status === "completed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      className="text-green-600 opacity-100 font-medium"
                    >
                      Completed
                    </Button>
                  )}
                </div>

                <AlertDialog
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setTaskToDelete(task.id);
                        setDeleteDialogOpen(true);
                      }}
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
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* Pager */}
      <div className="flex justify-center py-6">
        {loadingMore ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
             <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
             Loading tasks...
          </div>
        ) : hasMore ? (
          <Button variant="secondary" onClick={loadMore}>Load More Tasks</Button>
        ) : (
          tasks.length > 0 && <p className="text-sm text-muted-foreground">You've reached the end of the list.</p>
        )}
      </div>

      {/* Proof Dialog */}
      <Dialog open={proofDialogOpen} onOpenChange={setProofDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Proof of Work</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="picture">Evidence</Label>
                <Input
                id="picture"
                type="file"
                accept="image/*"
                className="cursor-pointer"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                />
                <p className="text-[12px] text-muted-foreground">Upload a screenshot or photo (Max 50MB)</p>
            </div>
            
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setProofFile(null);
                  setSelectedTaskId(null);
                  setProofDialogOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button disabled={!proofFile || isSubmittingProof} onClick={handleSubmitProof}>
                {isSubmittingProof ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span> Uploading...
                  </>
                ) : (
                  "Submit Proof"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskList;