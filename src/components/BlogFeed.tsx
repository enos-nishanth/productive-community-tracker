import { useEffect, useState, useRef, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Plus,
  Heart,
  MessageCircle,
  Send,
  MoreHorizontal,
  Trash,
  Search,
  Image as ImageIcon,
  Loader2,
  Video,
} from "lucide-react";
import { format } from "date-fns";
import { compressVideo } from "@/lib/compressVideo";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface BlogPost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  likes_count: number;
  created_at: string;
  image_url?: string | null;
  profiles: {
    username: string;
    full_name: string | null;
  };
  comments?: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    profiles: {
      username: string;
      full_name: string | null;
    };
  }[];
}

interface BlogFeedProps {
  userId: string;
}

const BlogFeed = ({ userId }: BlogFeedProps) => {
  const PAGE_SIZE = 10;
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState<string | null>(null);
  const [newPost, setNewPost] = useState({ title: "", content: "", tags: "" });
  const [newComment, setNewComment] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  type PostComment = BlogPost["comments"][number];
  const [postComments, setPostComments] = useState<Record<string, PostComment[]>>({});
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const fetchLikedPosts = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", userId);
    if (error) {
      console.error("Failed to fetch liked posts:", error);
      return;
    }
    const likedIds = new Set((data || []).map((item) => item.post_id as string));
    setLikedPosts(likedIds);
  }, [userId]);

  useEffect(() => {
    fetchLikedPosts();
  }, [fetchLikedPosts]);

  // 🔹 Fetch posts
  const fetchPosts = useCallback(
    async (pageNum = 0, search = "") => {
      if (loadingMore || !hasMore) return;
      setLoadingMore(true);

      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("blog_posts")
        .select(`
      *,
      profiles (username, full_name),
      comments (
        id,
        content,
        created_at,
        user_id,
        profiles (username, full_name)
      )
    `)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (search.trim() !== "") {
        query = query.or(
          `title.ilike.%${search}%,tags.cs.{${search.toLowerCase()}}`
        );
      }

      const { data, error } = await query;

      if (error) {
        toast.error("Failed to fetch posts");
        setLoadingMore(false);
        return;
      }

      if (!data || data.length === 0) {
        setHasMore(false);
        setLoadingMore(false);
        return;
      }

      setPosts((prev) => (pageNum === 0 ? data : [...prev, ...data]));
      setPage(pageNum + 1);
      setLoadingMore(false);
    },
    [loadingMore, hasMore]
  );

  useEffect(() => {
    fetchPosts(0, searchTerm);
    fetchLikedPosts();
  }, [fetchPosts, fetchLikedPosts, searchTerm]);

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchPosts(0, searchTerm);
    }, 500);
    return () => clearTimeout(delay);
  }, [searchTerm, fetchPosts]);

  const uploadImage = async () => {
    if (!selectedImage) return null;
    let fileToUpload = selectedImage;

    if (fileToUpload.type.startsWith("video/")) {
      toast.info("Compressing video, please wait...");
      fileToUpload = await compressVideo(fileToUpload);
    }

    if (fileToUpload.size > 50 * 1024 * 1024) {
      toast.error("File too large (limit 50 MB)");
      return null;
    }

    const { data, error } = await supabase.storage
      .from("post-images")
      .upload(`${Date.now()}-${fileToUpload.name}`, fileToUpload);

    if (error) {
      toast.error("Upload failed");
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("post-images")
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  };

  const handleCreatePost = async () => {
    if (isPublishing) return;
    setIsPublishing(true);

    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast.error("Please fill in title and content");
      setIsPublishing(false);
      return;
    }

    const imageUrl = await uploadImage();

    if (selectedImage && !imageUrl) {
      toast.error("Post not published: file upload failed or too large");
      setIsPublishing(false);
      return;
    }

    const tags = newPost.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const { error } = await supabase.from("blog_posts").insert({
      user_id: userId,
      title: newPost.title,
      content: newPost.content,
      tags,
      image_url: imageUrl,
    });

    if (error) {
      toast.error("Failed to create post");
      setIsPublishing(false);
      return;
    }

    toast.success("Post published!");
    setIsDialogOpen(false);
    setNewPost({ title: "", content: "", tags: "" });
    setSelectedImage(null);
    setPreviewUrl(null);
    fetchPosts();
    setIsPublishing(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedImage(file || null);
    if (file) {
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
    } else {
      setPreviewUrl(null);
    }
  };

  const fetchComments = async (postId: string) => {
    const { data, error } = await supabase
      .from("comments")
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles (username, full_name)
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load comments");
      return;
    }

    setPostComments((prev) => ({
      ...prev,
      [postId]: (data || []) as PostComment[],
    }));
  };

  const handleLike = async (postId: string) => {
    const { data: existingLike } = await supabase
      .from("likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .single();

    if (existingLike) {
      await supabase
        .from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
      await supabase.rpc("decrement_likes", { post_id: postId });
    } else {
      await supabase
        .from("likes")
        .insert({ post_id: postId, user_id: userId });
      await supabase.rpc("increment_likes", { post_id: postId });
    }

    fetchPosts();
    fetchLikedPosts();
  };

  const handleComment = async (postId: string) => {
    if (!newComment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: userId,
      content: newComment,
    });

    if (error) {
      toast.error("Failed to post comment");
      return;
    }

    toast.success("Comment posted!");
    setNewComment("");
    fetchComments(postId);
  };

  const handleDeletePost = async (postId: string, imageUrl?: string | null) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this post?"
    );
    if (!confirmDelete) return;

    const { error } = await supabase.from("blog_posts").delete().eq("id", postId);
    if (error) {
      toast.error("Failed to delete post");
      return;
    }

    if (imageUrl) {
      try {
        const fileName = imageUrl.split("/").pop();
        if (fileName) {
          await supabase.storage.from("post-images").remove([fileName]);
        }
      } catch (e) {
        console.warn("Failed to remove media:", e);
      }
    }

    toast.success("Post deleted!");
    fetchPosts();
  };

  const filteredPosts = posts.filter((post) => {
    const titleMatch = post.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const tagMatch = post.tags.some((tag) =>
      tag.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return titleMatch || tagMatch;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-4 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Community Feed</h2>
          <p className="text-muted-foreground text-sm">
            Discover stories, share your journey.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* New Post Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-9 gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Post</span>
              </Button>
            </DialogTrigger>
            {/* UI FIX: Added max-h-[85vh] to ensure modal fits on screen and scrolls internally */}
            <DialogContent className="max-w-xl w-full max-h-[85vh] overflow-y-auto sm:rounded-lg">
              <DialogHeader>
                <DialogTitle>Create New Post</DialogTitle>
                <DialogDescription>
                  Share your latest updates with the community.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-5 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newPost.title}
                    onChange={(e) =>
                      setNewPost({ ...newPost, title: e.target.value })
                    }
                    placeholder="Give your post a headline..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    value={newPost.content}
                    onChange={(e) =>
                      setNewPost({ ...newPost, content: e.target.value })
                    }
                    placeholder="What's on your mind today?"
                    className="min-h-[150px] resize-y"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Media Attachment</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      id="media-upload"
                      className="hidden"
                      accept="image/*,video/*"
                      onChange={handleImageSelect}
                    />
                    <Label
                      htmlFor="media-upload"
                      className="cursor-pointer flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent transition-colors text-sm font-medium"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Select Image/Video
                    </Label>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {selectedImage ? selectedImage.name : "No file selected"}
                    </span>
                  </div>

                  {/* Preview Area */}
                  {previewUrl && (
                    <div className="mt-2 relative rounded-md overflow-hidden border bg-muted/30">
                      {selectedImage &&
                      selectedImage.type.startsWith("video/") ? (
                        <video
                          src={previewUrl}
                          controls
                          className="w-full max-h-[300px] object-contain"
                        />
                      ) : (
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="w-full max-h-[300px] object-contain"
                        />
                      )}
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => {
                          setSelectedImage(null);
                          setPreviewUrl(null);
                        }}
                      >
                        <Trash className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    value={newPost.tags}
                    onChange={(e) =>
                      setNewPost({ ...newPost, tags: e.target.value })
                    }
                    placeholder="e.g. productivity, lifestyle (comma separated)"
                  />
                </div>
              </div>

              <Button
                onClick={handleCreatePost}
                disabled={isPublishing}
                className="w-full"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Publish Post"
                )}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* --- Posts Grid --- */}
      <div className="space-y-6">
        {filteredPosts.length === 0 ? (
          <Card className="border-dashed shadow-none bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-background p-4 rounded-full shadow-sm mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No posts found</h3>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">
                We couldn't find any posts matching your search. Try different
                keywords or start a new conversation.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredPosts.map((post) => (
            <Card
              key={post.id}
              className="border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
                <Avatar className="h-10 w-10 border">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {post.profiles.username?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold leading-none truncate">
                        {post.profiles.full_name || post.profiles.username}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(post.created_at), "MMM d, yyyy")}
                      </p>
                    </div>

                    {post.user_id === userId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 -mr-2 text-muted-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive cursor-pointer"
                            onClick={() =>
                              handleDeletePost(post.id, post.image_url)
                            }
                          >
                            <Trash className="h-4 w-4 mr-2" /> Delete Post
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pb-3">
                <div className="space-y-2">
                  <h3 className="text-lg font-bold leading-tight">
                    {post.title}
                  </h3>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {post.content}
                  </p>
                </div>

                {/* Media Rendering */}
                {post.image_url && (
                  <div className="rounded-lg overflow-hidden border bg-black/5 mt-3">
                    {post.image_url.match(/\.(mp4|webm|ogg)$/i) ? (
                      <div className="relative">
                        <video
                          src={post.image_url}
                          controls
                          className="w-full max-h-[500px] object-contain mx-auto"
                        />
                      </div>
                    ) : (
                      <img
                        src={post.image_url}
                        alt="Post attachment"
                        className="w-full max-h-[500px] object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                )}

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {post.tags.map((tag, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="font-normal text-xs px-2 py-0.5"
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>

              {/* --- Footer / Actions --- */}
              <CardFooter className="flex flex-col border-t bg-muted/5 p-0">
                <div className="flex items-center p-2 w-full">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`flex-1 gap-2 hover:bg-transparent ${
                      likedPosts.has(post.id)
                        ? "text-red-500 hover:text-red-600"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => handleLike(post.id)}
                  >
                    <Heart
                      className={`h-4 w-4 transition-transform active:scale-125 ${
                        likedPosts.has(post.id) ? "fill-current" : ""
                      }`}
                    />
                    <span className="text-xs">
                      {post.likes_count > 0 ? post.likes_count : "Like"}
                    </span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-2 text-muted-foreground hover:text-foreground hover:bg-transparent"
                    onClick={() => {
                      if (commentDialogOpen === post.id) {
                        setCommentDialogOpen(null);
                      } else {
                        setCommentDialogOpen(post.id);
                        if (!postComments[post.id]) fetchComments(post.id);
                      }
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-xs">
                      {postComments[post.id]?.length || 0} Comments
                    </span>
                  </Button>

                  {/* Add Comment Trigger */}
                  <Dialog
                    open={commentDialogOpen === `${post.id}-add`}
                    onOpenChange={(open) =>
                      setCommentDialogOpen(open ? `${post.id}-add` : null)
                    }
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 gap-2 text-muted-foreground hover:text-foreground hover:bg-transparent"
                      >
                        <Send className="h-4 w-4" />
                        <span className="text-xs">Reply</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add a Comment</DialogTitle>
                        <DialogDescription>
                          Reply to{" "}
                          <span className="font-medium text-foreground">
                            {post.profiles.username}
                          </span>
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <Textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Write your thoughts..."
                          className="min-h-[100px]"
                        />
                        <Button
                          onClick={() => handleComment(post.id)}
                          className="w-full gap-2"
                        >
                          <Send className="h-4 w-4" /> Post Comment
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* --- Collapsible Comments Section --- */}
                {commentDialogOpen === post.id && (
                  <div className="w-full bg-muted/30 border-t p-4 animate-in slide-in-from-top-2 duration-200">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Discussion
                    </h4>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                      {postComments[post.id]?.length ? (
                        postComments[post.id].map((comment) => (
                          <div
                            key={comment.id}
                            className="flex gap-3 text-sm group"
                          >
                            <Avatar className="w-8 h-8 border">
                              <AvatarFallback className="bg-background text-xs">
                                {comment.profiles.username
                                  .charAt(0)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 bg-background border rounded-lg p-3 shadow-sm">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-xs">
                                  {comment.profiles.full_name ||
                                    comment.profiles.username}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {format(
                                    new Date(comment.created_at),
                                    "MMM d, h:mm a"
                                  )}
                                </span>
                              </div>
                              <p className="text-muted-foreground leading-relaxed">
                                {comment.content}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          No comments yet. Be the first to say something!
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* --- Loader --- */}
      <div ref={loaderRef} className="flex justify-center py-8">
        {loadingMore ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more...
          </div>
        ) : !hasMore && posts.length > 0 ? (
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            End of Feed
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default BlogFeed;