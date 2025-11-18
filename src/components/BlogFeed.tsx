import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Plus, Heart, MessageCircle, Send, MoreHorizontal, Trash } from "lucide-react";
import { format } from "date-fns";
import { compressVideo } from "@/lib/compressVideo";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Value } from "@radix-ui/react-select";

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
  const PAGE_SIZE = 10; // how many posts to load at once
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


  // 🔹 Fetch posts from Supabase (with comments)
  const fetchPosts = useCallback(async (pageNum = 0, search = "") => {
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
    query = query.or(`title.ilike.%${search}%,tags.cs.{${search.toLowerCase()}}`);
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

  // If page = 0 (first load or new search), replace; else append
  setPosts((prev) => (pageNum === 0 ? data : [...prev, ...data]));
  setPage(pageNum + 1);
  setLoadingMore(false);
}, [loadingMore, hasMore]);

  // initial load after callbacks exist
  useEffect(() => {
    fetchPosts(0, searchTerm);
    fetchLikedPosts();
  }, [fetchPosts, fetchLikedPosts, searchTerm]);

  // 🔍 Debounced search effect (after fetchPosts defined)
  useEffect(() => {
    const delay = setTimeout(() => {
      fetchPosts(0, searchTerm);
    }, 500);
    return () => clearTimeout(delay);
  }, [searchTerm, fetchPosts]);
  
  // 🔹 Upload image or video to Supabase Storage
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

  // 🔹 Create a new post
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
      toast.error("Post not published: file upload failed or too large (max 50 MB)");
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

  // 🔹 Handle image or video preview
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

    setPostComments((prev) => ({ ...prev, [postId]: (data || []) as PostComment[] }));
  };

  // 🔹 Like functionality
  const handleLike = async (postId: string) => {
    const { data: existingLike } = await supabase
      .from("likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .single();

    if (existingLike) {
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId);
      await supabase.rpc("decrement_likes", { post_id: postId });
    } else {
      await supabase.from("likes").insert({ post_id: postId, user_id: userId });
      await supabase.rpc("increment_likes", { post_id: postId });
    }

    fetchPosts();
    fetchLikedPosts();
  };

  // 🔹 Comment on a post
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
    fetchComments(postId); // ✅ refresh only that post’s comments
  };


  // 🔹 Delete a post
  const handleDeletePost = async (postId: string, imageUrl?: string | null) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this post?");
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

  // 🔹 Filter posts by search term
  const filteredPosts = posts.filter((post) => {
    const titleMatch = post.title.toLowerCase().includes(searchTerm.toLowerCase());
    const tagMatch = post.tags.some((tag) =>
      tag.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return titleMatch || tagMatch;
  });

  return (
    <div className="space-y-4">
      {/* Header and New Post Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Community Feed</h2>
          <p className="text-muted-foreground">Share your thoughts🚀.....</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Post</DialogTitle>
              <DialogDescription>Share your story with the community</DialogDescription>
            </DialogHeader>

            {/* Post Form */}
            <div className="space-y-4">
              <Label>Title</Label>
              <Input
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                placeholder="What's on your mind?"
              />

              <Label>Content</Label>
              <Textarea
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                placeholder="Write something inspiring..."
                rows={6}
              />

              <Label>Optional Image/Video</Label>
              <Input type="file" accept="image/*,video/*" onChange={handleImageSelect} />
              {previewUrl && selectedImage && selectedImage.type.startsWith("video/") ? (
                <video src={previewUrl} controls className="mt-2 rounded-lg max-h-64 border" />
              ) : (
                previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="mt-2 rounded-lg max-h-64 object-cover border"
                  />
                )
              )}

              <Label>Tags (comma-separated)</Label>
              <Input
                value={newPost.tags}
                onChange={(e) => setNewPost({ ...newPost, tags: e.target.value })}
                placeholder="productivity, learning, growth"
              />

              <Button onClick={handleCreatePost} className="w-full" disabled={isPublishing}>
                {isPublishing ? "Publishing..." : "Publish Post"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 🧩 Search Bar */}
      <div className="my-4">
        <Input
          type="text"
          placeholder="Search posts by title or tag..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Posts Display */}
      <div className="grid gap-4">
        {filteredPosts.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <MessageCircle className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No posts found</p>
              <p className="text-sm text-muted-foreground">
                Try changing your search term or create a new post!
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredPosts.map((post) => (
            <Card key={post.id} className="shadow-card hover:shadow-primary transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar>
                      <AvatarFallback className="bg-gradient-primary text-white">
                        {post.profiles.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{post.title}</CardTitle>
                      <CardDescription>
                        by {post.profiles.full_name || post.profiles.username} •{" "}
                        {format(new Date(post.created_at), "MMM d, yyyy")}
                      </CardDescription>
                    </div>
                  </div>

                  {post.user_id === userId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-red-600 cursor-pointer"
                          onClick={() => handleDeletePost(post.id, post.image_url)}
                        >
                          <Trash className="h-4 w-4 mr-2" /> Delete Post
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-foreground whitespace-pre-wrap mb-4">{post.content}</p>

                {post.image_url && (
                  post.image_url.match(/\.(mp4|webm|ogg)$/i) ? (
                    <video src={post.image_url} controls className="rounded-lg mb-4 max-h-96 border" />
                  ) : (
                    <img
                      src={post.image_url}
                      alt="Post media"
                      className="rounded-lg mb-4 max-h-96 object-cover border"
                    />
                  )
                )}

                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 pt-4 border-t">
                  {/* ❤️ Like Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`gap-2 ${likedPosts.has(post.id) ? "text-red-500" : "text-muted-foreground"}`}
                    onClick={() => handleLike(post.id)}
                  >
                    <Heart
                      className={`h-4 w-4 ${likedPosts.has(post.id) ? "fill-red-500 text-red-500" : ""}`}
                    />
                    {post.likes_count}
                  </Button>

                  {/* 💬 Toggle Comments Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      if (commentDialogOpen === post.id) {
                        setCommentDialogOpen(null);
                      } else {
                        setCommentDialogOpen(post.id);
                      if (!postComments[post.id]) fetchComments(post.id); // lazy load
                      }
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    {postComments[post.id]?.length || 0}
                  </Button>


                  {/* ➕ Add Comment Dialog */}
                  <Dialog
                    open={commentDialogOpen === `${post.id}-add`}
                    onOpenChange={(open) =>
                    setCommentDialogOpen(open ? `${post.id}-add` : null)
                  }
                  >
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Send className="h-4 w-4" />
                          Add
                      </Button>
                    </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Comment</DialogTitle>
                    </DialogHeader>
                  <div className="space-y-4">
                   <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Share your thoughts..."
                      rows={4}
                    />
                    <Button
                      onClick={() => handleComment(post.id)}
                      className="w-full gap-2"
                    >
                      <Send className="h-4 w-4" />
                        Post Comment
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* 🧩 Collapsible Comments Section */}
            {commentDialogOpen === post.id && (
              <div className="mt-4 border-t pt-3 space-y-3 animate-slide-down">
                <h4 className="font-semibold text-sm text-muted-foreground">
                  Comments ({postComments[post.id]?.length || 0})
                </h4>

                {postComments[post.id]?.length ? (
                  postComments[post.id].map((comment) => (
                    <div key={comment.id} className="flex gap-3 text-sm">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-gradient-primary text-white">
                          {comment.profiles.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {comment.profiles.full_name || comment.profiles.username}
                        </span>
                        <span className="text-muted-foreground">{comment.content}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), "MMM d, yyyy • h:mm a")}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                )}
              </div>
            )}

              </CardContent>
            </Card>
          ))
        )}
      </div>
      {/* Infinite Scroll Loader */}
      <div ref={loaderRef} className="flex justify-center py-6">
        {loadingMore ? (
        <p className="text-sm text-muted-foreground">Loading more posts...</p>
        ) : !hasMore ? (
        <p className="text-sm text-muted-foreground">No more posts to load</p>
        ) : null}
      </div>
    </div>
  );
};

export default BlogFeed;
