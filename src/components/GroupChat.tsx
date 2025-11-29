// src/components/GroupChat.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import {
  Send,
  Paperclip,
  Reply,
  Download,
  X,
  Edit2,
  MoreHorizontal,
  Trash2,
  Eye,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card as PopupCard, CardContent as PopupContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ---------------- Types ---------------- */
interface Message {
  id: string;
  user_id: string;
  content: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  reply_to?: string | null;
  created_at: string;
  edited?: boolean;
  is_deleted?: boolean;
  reactions?: Array<{ emoji: string; user_ids: string[] }>;
  seen_by?: string[];
  profiles?: { id?: string; username?: string; full_name?: string | null } | null;
  replied_message?: { id?: string; content: string; profiles?: { username?: string } } | null;
}

interface UserProfile {
  id: string;
  username: string;
  full_name?: string | null;
}

/* ---------------- Helpers ---------------- */
const avatarColorFromId = (id: string) => {
  const colors = [
    "bg-rose-400",
    "bg-orange-400",
    "bg-amber-400",
    "bg-lime-400",
    "bg-emerald-400",
    "bg-teal-400",
    "bg-sky-400",
    "bg-indigo-400",
    "bg-violet-400",
    "bg-fuchsia-400",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return colors[Math.abs(h) % colors.length];
};

const formatDateHeader = (iso: string) => {
  const dt = new Date(iso);
  if (isToday(dt)) return "Today";
  if (isYesterday(dt)) return "Yesterday";
  return format(dt, "MMM d, yyyy");
};

const EMOJIS = ["👍", "❤️", "🔥", "😂", "🎉", "😮", "👏"];

/* ---------------- Component ---------------- */
const GroupChat: React.FC<{ userId: string }> = ({ userId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const [typingUsersMap, setTypingUsersMap] = useState<Record<string, number>>({});

  const [newMessage, setNewMessage] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const [openPreviewUrl, setOpenPreviewUrl] = useState<string | null>(null);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showEmojiPopup, setShowEmojiPopup] = useState(false);
  const [showGifPopup, setShowGifPopup] = useState(false);
  const [gifResults, setGifResults] = useState<Array<{ id: string; url: string }>>([]);
  const [gifQuery, setGifQuery] = useState("");
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const emojiBtnRef = useRef<HTMLButtonElement | null>(null);
  const [emojiPortalPos, setEmojiPortalPos] = useState<{ left: number; top: number } | null>(null);
  const emojiPortalRef = useRef<HTMLDivElement | null>(null);
  
  const emojiPopupRef = useRef<HTMLDivElement | null>(null);
  const gifBtnRef = useRef<HTMLButtonElement | null>(null);
  const gifPopupRef = useRef<HTMLDivElement | null>(null);
  const [gifPortalPos, setGifPortalPos] = useState<{ left: number; top: number } | null>(null);



  /* ---------------- Fetchers ---------------- */
  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(`*, profiles:profiles!fk_messages_profiles_user_id (id, username, full_name)`)
        .order("created_at", { ascending: true });
        
      if (error) {
        console.error("fetchMessages error", error);
        toast.error("Failed to fetch messages");
        return;
      }
      const enriched = await Promise.all(
        (data || []).map(async (m) => {
        const base = m as unknown as Message;
        if (m.reply_to) {
          const { data: replied } = await supabase
          .from("messages")
          .select("id, content, profiles:profiles!fk_messages_profiles_user_id (username, full_name)")
          .eq("id", m.reply_to)
          .single();

          return {
            ...base,
            replied_message: replied
              ? {
                id: replied.id,
                content: replied.content,
                profiles: replied.profiles
                  ? { username: replied.profiles.username, full_name: replied.profiles.full_name }
                  : null,
              }
              : null,
          };
        }
          return base;
        })
      );
      setMessages(enriched as Message[]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      console.error("fetchMessages unexpected error", err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("id, username, full_name");
      if (error) {
        console.error("fetchUsers error", error);
        return;
      }
      setUsers(data || []);
      // optional online status
      try {
      const { data: statusData } = await supabase.from("user_status").select("user_id, online").in("user_id", (data || []).map((d) => (d as { id: string }).id));
        const map: Record<string, boolean> = {};
        (statusData || []).forEach((r: { user_id: string; online: boolean | null }) => (map[r.user_id] = !!r.online));
        setOnlineMap(map);
      } catch {
        // ignore
      }
    } catch (err) {
      console.error("fetchUsers unexpected", err);
    }
  }, []);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // --- Emoji ---
      const clickedInsideEmoji =
        emojiPortalRef.current?.contains(target) ||
        emojiBtnRef.current?.contains(target);

      // --- GIF ---
      const clickedInsideGif =
        gifPopupRef.current?.contains(target) ||
        gifBtnRef.current?.contains(target);

      // If clicked outside both
      if (!clickedInsideEmoji && !clickedInsideGif) {
        setShowEmojiPopup(false);
        setEmojiPortalPos(null);
        setShowGifPopup(false);
        setGifPortalPos(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  /* ---------------- Realtime ---------------- */
  useEffect(() => {
    fetchMessages();
    fetchUsers();

    const channel = supabase
      .channel("public:messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },  (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new as Message : m));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchMessages, fetchUsers]);

  /* ---------------- Typing ---------------- */
  const notifyTyping = useCallback(
    async (isTyping: boolean) => {
      try {
        await supabase.from("typing").upsert({ user_id: userId, last_typing_at: isTyping ? new Date().toISOString() : null }, { onConflict: "user_id" });
      } catch {
        // ignore
      }
    },
    [userId]
  );

  const fetchTyping = useCallback(async () => {
    try {
      const { data } = await supabase.from("typing").select("user_id, last_typing_at");
      const map: Record<string, number> = {};
      (data || []).forEach((r: { user_id: string; last_typing_at: string | null }) => {
        if (r.last_typing_at) map[r.user_id] = new Date(r.last_typing_at).getTime();
      });
      setTypingUsersMap(map);
    } catch {
      // ignore
    }
  }, []);

  // keep a single interval to refresh typing information
  useEffect(() => {
    fetchTyping();
    const id = setInterval(() => {
      fetchTyping();
    }, 2000);
    return () => clearInterval(id);
  }, [fetchTyping]);

  /* ---------------- Upload ---------------- */
  const uploadAttachment = async (file: File) => {
    const sanitized = file.name.replace(/\s+/g, "_").replace(/[^\w.-]/g, "_");
    const path = `${userId}/${Date.now()}_${sanitized}`;
    const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
    if (error) {
      console.error("upload error", error);
      toast.error("Upload failed");
      return null;
    }
    const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    return { publicUrl: data?.publicUrl || null, path };
  };

  /* ---------------- Send ---------------- */
  const handleSendMessage = async () => {
    if (!newMessage.trim() && !attachment) {
      toast.error("Type a message or attach a file");
      return;
    }
    let attachment_url: string | null = null;
    let attachment_name: string | null = null;
    if (attachment) {
      const res = await uploadAttachment(attachment);
      if (!res?.publicUrl) {
        toast.error("Attachment upload failed");
        return;
      }
      attachment_url = res.publicUrl;
      attachment_name = attachment.name;
    }
    const payload = {
      user_id: userId,
      content: newMessage,
      attachment_url,
      attachment_name,
      reply_to: replyTo?.id || null,
      reactions: [],
      seen_by: [userId],
      edited: false,
      is_deleted: false,
    };
    const { error } = await supabase.from("messages").insert(payload);
    if (error) {
      console.error("send error", error);
      toast.error("Failed to send message");
      return;
    }
    setNewMessage("");
    setAttachment(null);
    setFileInputKey(Date.now());
    setReplyTo(null);
    notifyTyping(false);
    fetchMessages();
    setSelectedMessage(null);
  };

  /* ---------------- Seen ---------------- */
  const markSeenForLast = async () => {
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.seen_by && Array.isArray(last.seen_by) && last.seen_by.includes(userId)) return;
    try {
      await supabase.from("messages").update({ seen_by: [...(last.seen_by || []), userId] }).eq("id", last.id);
    } catch {
      // ignore
    }
  };
  useEffect(() => {
    markSeenForLast();
    const id = setInterval(() => markSeenForLast(), 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  /* ---------------- Actions ---------------- */
  const startEdit = (m: Message) => {
    setEditingMessageId(m.id);
    setEditingText(m.content);
    setSelectedMessage(null);
  };
  const submitEdit = async () => {
    if (!editingMessageId) return;
    const { error } = await supabase.from("messages").update({ content: editingText, edited: true }).eq("id", editingMessageId);
    if (error) {
      toast.error("Failed to edit");
      return;
    }
    setEditingMessageId(null);
    setEditingText("");
    fetchMessages();
  };
  const deleteMessage = async (m: Message) => {
    if (!confirm("Delete message? This will hide it for everyone.")) return;
    const { error } = await supabase.from("messages").update({ is_deleted: true }).eq("id", m.id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Message deleted");
    fetchMessages();
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    const msgIndex = messages.findIndex((x) => x.id === messageId);
    if (msgIndex === -1) return;

    const updatedMessages = [...messages];
    const msg = { ...updatedMessages[msgIndex] };
    type Reaction = { emoji: string; user_ids: string[] };
    const reactions: Reaction[] = Array.isArray(msg.reactions) ? [...(msg.reactions as Reaction[])] : [];

    const existing = reactions.find((r) => r.emoji === emoji);
    if (existing) {
      if (existing.user_ids.includes(userId)) {
        existing.user_ids = existing.user_ids.filter((id: string) => id !== userId);
        if (existing.user_ids.length === 0) {
          const idx = reactions.findIndex((r) => r.emoji === emoji);
          if (idx >= 0) reactions.splice(idx, 1);
        }
      } else {
        existing.user_ids.push(userId);
      }
    } else {
      reactions.push({ emoji, user_ids: [userId] });
    }

    // Update in Supabase
    const { error } = await supabase.from("messages").update({ reactions }).eq("id", messageId);
    if (error) {
      toast.error("Failed to react");
      return;
    }
    // ✅ Update locally — no need to refetch
    msg.reactions = reactions;
    updatedMessages[msgIndex] = msg;
    setMessages(updatedMessages); // <--- key line
  };


  const seenByNames = (seen_by?: string[]) => {
    if (!seen_by || seen_by.length === 0) return "No one";
    const names = seen_by.map((uid) => {
      const u = users.find((uu) => uu.id === uid);
      return u ? (u.full_name || u.username) : uid;
    });
    return names.slice(0, 20).join(", ");
  };

  /* ---------------- GIF search (Tenor) ---------------- */
  const searchGifs = async (q: string) => {
    const key = import.meta.env.VITE_TENOR_KEY;
    if (!key) {
      setGifError("Tenor API key not configured (VITE_TENOR_KEY).");
      setGifResults([]);
      return;
    }
    setGifError(null);
    setGifLoading(true);
    try {
      const query = q.trim();
      const endpoint = query
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${key}&client_key=myapp&limit=12&media_filter=gif`
        : `https://tenor.googleapis.com/v2/featured?key=${key}&client_key=myapp&limit=12&media_filter=gif`;

      console.log("Fetching:", endpoint);
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(`Tenor fetch failed (${res.status})`);
      }
      const json = await res.json();
      console.log("Response JSON:", json);

      const results = (json.results || []).map((r: { id: string; media_formats?: { gif?: { url?: string }; mediumgif?: { url?: string }; tinygif?: { url?: string } } }) => {
        // Prefer gif, mediumgif, tinygif
        const url = r.media_formats?.gif?.url || r.media_formats?.mediumgif?.url || r.media_formats?.tinygif?.url;
        return { id: r.id, url };
      });

      setGifResults(results.filter((r) => r.url));
      if ((results.filter((r) => r.url)).length === 0) {
        setGifError("No GIFs found for that search.");
      }
    } catch (err: unknown) {
      console.error("searchGifs error", err);
      const msg = err instanceof Error ? err.message : "Failed to fetch GIFs";
      setGifError(msg);
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  };

  const sendGif = async (gifUrl: string) => {
    const { error } = await supabase.from("messages").insert({
      user_id: userId,
      content: "",
      attachment_url: gifUrl,
      attachment_name: "gif.gif",
      seen_by: [userId],
      reactions: [],
      edited: false,
      is_deleted: false,
    });
    if (error) toast.error("Failed to send gif");
    else {
      setShowGifPopup(false);
      fetchMessages();
    }
  };

  /* ---------------- UI helpers ---------------- */
  const onMessageChange = (val: string) => {
    setNewMessage(val);
    notifyTyping(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => notifyTyping(false), 2000);
  };

  const openPreview = (url: string) => setOpenPreviewUrl(url);
  const groupedWithDates = (): Array<{ dateHeader: string; messages: Message[] }> => {
    const out: Array<{ dateHeader: string; messages: Message[] }> = [];
    let lastDate: string | null = null;
    messages.forEach((m) => {
      const header = formatDateHeader(m.created_at);
      if (lastDate !== header) {
        out.push({ dateHeader: header, messages: [m] });
        lastDate = header;
      } else {
        out[out.length - 1].messages.push(m);
      }
    });
    return out;
  };

  /* ---------------- Emoji portal positioning ---------------- */
  const openEmojiPortal = () => {
    setShowEmojiPopup(true);
    const btn = emojiBtnRef.current;
    if (!btn) {
      setEmojiPortalPos(null);
      return;
    }
    const rect = btn.getBoundingClientRect();
    // position slightly above the button and left-aligned to the button.
    // We compute top as rect.top - approxPopupHeight. If that goes off-screen, clamp to 8px.
    const approxPopupHeight = 200; // reasonable default; popup will adjust visually
    let top = rect.top - approxPopupHeight - 8;
    if (top < 8) top = rect.bottom + 8; // if no room above, place below
    const left = Math.max(8, rect.left); // clamp to viewport
    setEmojiPortalPos({ left, top });
  };

  const closeEmojiPortal = () => {
    setShowEmojiPopup(false);
    setEmojiPortalPos(null);
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="flex flex-col h-[85vh] w-full max-w-5xl mx-auto border rounded-xl shadow-xl overflow-hidden bg-background">
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between p-4 border-b bg-card/50 backdrop-blur-sm z-10">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            Community Chat
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </h2>
          <p className="text-xs text-muted-foreground">
            Connect with fellow members in real-time
          </p>
        </div>
        
        {/* Typing Indicator (Header Version) */}
        <div className="text-xs text-muted-foreground h-4">
           {Object.keys(typingUsersMap).filter(
              (uid) => uid !== userId && Date.now() - (typingUsersMap[uid] || 0) < 6000
            ).length > 0 && (
              <span className="animate-pulse text-primary font-medium">
                {Object.keys(typingUsersMap)
                  .filter((uid) => uid !== userId && Date.now() - (typingUsersMap[uid] || 0) < 6000)
                  .map((uid) => {
                    const u = users.find((x) => x.id === uid);
                    return u ? u.full_name || u.username : uid;
                  })
                  .slice(0, 2) // Limit names
                  .join(", ")}
                {Object.keys(typingUsersMap).length > 2 ? "..." : ""} is typing...
              </span>
            )}
        </div>
      </div>

      {/* --- MAIN CHAT AREA --- */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 dark:bg-black/20 relative"
      >
        {/* Background Watermark */}
        <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none bg-center bg-no-repeat bg-contain"
            style={{ backgroundImage: "url('/src/assets/logo.png')" }}
        />

        {groupedWithDates().map((group) => (
            <div key={group.dateHeader} className="relative z-0">
              {/* Date Separator */}
              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-muted" />
                <span className="flex-shrink-0 mx-4 text-xs font-medium text-muted-foreground bg-background/50 px-2 py-1 rounded-full border">
                  {group.dateHeader}
                </span>
                <div className="flex-grow border-t border-muted" />
              </div>

              {group.messages.map((message) => {
                const mine = message.user_id === userId;

                // DELETED MESSAGE UI
                if (message.is_deleted) {
                  return (
                    <div key={message.id} className={`flex ${mine ? "flex-row-reverse" : "flex-row"} gap-3 mb-2`}>
                      <Avatar className="h-8 w-8 opacity-50">
                        <AvatarFallback>{message.profiles?.username?.charAt(0)?.toUpperCase() ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div className="border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-2 rounded-lg text-xs italic text-muted-foreground">
                        Message deleted
                      </div>
                    </div>
                  );
                }

                // NORMAL MESSAGE UI
                return (
                  <div
                    key={message.id}
                    onMouseEnter={() => setHoveredMessageId(message.id)}
                    onMouseLeave={() => setHoveredMessageId((id) => (id === message.id ? null : id))}
                    className={`group relative flex gap-3 mb-2 ${mine ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <Avatar className="h-8 w-8 mt-1 border shadow-sm">
                      <AvatarFallback className={`${avatarColorFromId(message.user_id)} text-white font-semibold text-xs`}>
                        {message.profiles?.username?.charAt(0)?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>

                    {/* Message Content Container */}
                    <div className={`relative flex flex-col max-w-[75%] ${mine ? "items-end" : "items-start"}`}>
                      
                      {/* Name & Time */}
                      <div className={`flex items-baseline gap-2 mb-1 px-1 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                        <span className="text-xs font-semibold text-foreground">
                            {message.profiles?.full_name || message.profiles?.username}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(message.created_at), "h:mm a")}
                          {message.edited && <span className="italic ml-1">(edited)</span>}
                        </span>
                      </div>

                      {/* Bubble */}
                      <div 
                        className={`relative px-4 py-2 shadow-sm text-sm
                            ${mine 
                                ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm" 
                                : "bg-white dark:bg-card border text-card-foreground rounded-2xl rounded-tl-sm"
                            }
                        `}
                      >
                        {/* Reply Context */}
                        {message.replied_message && (
                          <div className={`mb-2 p-2 rounded text-xs border-l-2 ${mine ? "bg-black/10 border-white/50" : "bg-muted border-primary"}`}>
                            <p className="font-semibold opacity-90 mb-0.5">
                                {message.replied_message.profiles?.username ?? "Unknown"}
                            </p>
                            <p className="opacity-75 truncate max-w-[200px]">
                                {message.replied_message.content}
                            </p>
                          </div>
                        )}

                        {/* Text / Edit Mode */}
                        {editingMessageId === message.id ? (
                          <div className="space-y-2 min-w-[200px]">
                            <Textarea 
                                value={editingText} 
                                onChange={(e) => setEditingText(e.target.value)} 
                                className="text-black bg-white min-h-[60px]" 
                            />
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="secondary" onClick={() => { setEditingMessageId(null); setEditingText(""); }}>Cancel</Button>
                              <Button size="sm" onClick={submitEdit}>Save</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                             {/* Message Text */}
                             {message.content && (
                                <p className="whitespace-pre-wrap break-words leading-relaxed">
                                    {message.content}
                                </p>
                             )}

                             {/* Attachment */}
                            {message.attachment_url && (
                              <div className="mt-2 rounded-lg overflow-hidden border bg-background/50 max-w-sm">
                                {/\.(png|jpe?g|webp|gif)$/i.test(message.attachment_name || "") ? (
                                  <img 
                                    src={message.attachment_url!} 
                                    alt="attachment" 
                                    className="max-h-60 w-full object-cover cursor-zoom-in hover:opacity-95 transition" 
                                    onClick={() => openPreview(message.attachment_url!)} 
                                  />
                                ) : (
                                  <div className="flex items-center gap-3 p-3">
                                    <div className="bg-muted p-2 rounded">
                                        <Paperclip className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="truncate text-xs font-medium">{message.attachment_name}</p>
                                    </div>
                                    <a href={message.attachment_url!} download target="_blank" rel="noreferrer">
                                      <Button size="icon" variant="ghost" className="h-8 w-8"><Download className="h-4 w-4" /></Button>
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Reactions - Placed slightly overlapping the bubble bottom */}
                      {(message.reactions || []).length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                           {(message.reactions || []).map((r: any) => (
                            <button
                                key={r.emoji}
                                onClick={() => toggleReaction(message.id, r.emoji)}
                                className={`
                                    flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border shadow-sm transition-all hover:scale-105
                                    ${r.user_ids?.includes(userId) ? "bg-blue-100 border-blue-200 text-blue-700" : "bg-white border-gray-100 text-gray-600"}
                                `}
                            >
                                <span>{r.emoji}</span>
                                <span>{r.user_ids?.length}</span>
                            </button>
                           ))}
                        </div>
                      )}

                      {/* --- HOVER ACTION MENU --- */}
                      <div 
                        className={`
                            absolute top-2 transition-all duration-200 z-10
                            ${hoveredMessageId === message.id ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}
                            ${mine ? "-left-10" : "-right-10"}
                        `}
                      >
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-md bg-background border">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1" side={mine ? "left" : "right"}>
                                {message.user_id === userId && (
                                    <>
                                        <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Actions</div>
                                        <button onClick={() => startEdit(message)} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded-sm text-left">
                                            <Edit2 className="h-3.5 w-3.5" /> Edit Message
                                        </button>
                                        <button onClick={() => deleteMessage(message)} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-red-50 text-red-600 rounded-sm text-left">
                                            <Trash2 className="h-3.5 w-3.5" /> Delete
                                        </button>
                                        <div className="h-px bg-border my-1" />
                                    </>
                                )}
                                <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">React</div>
                                <div className="grid grid-cols-4 gap-1 p-1">
                                    {EMOJIS.slice(0, 8).map((emoji) => (
                                        <button key={emoji} onClick={() => toggleReaction(message.id, emoji)} className="text-lg hover:bg-muted rounded p-1">
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>

                        {!mine && (
                            <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-md bg-background border mt-2" onClick={() => setReplyTo(message)} title="Reply">
                                <Reply className="h-4 w-4" />
                            </Button>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
      </div>

      {/* --- COMPOSER SECTION --- */}
      <div className="p-4 bg-background border-t">
        <div className="relative border rounded-xl shadow-sm bg-background transition-all focus-within:ring-1 focus-within:ring-ring focus-within:border-primary">
            
            {/* Context Previews (Reply / Attachment) - Positioned inside top */}
            {(replyTo || attachment) && (
                <div className="flex gap-2 p-2 border-b bg-muted/30 rounded-t-xl">
                    {replyTo && (
                        <div className="flex-1 flex items-center gap-2 text-xs bg-background border rounded px-2 py-1.5">
                            <Reply className="h-3 w-3 text-primary" />
                            <div className="flex-1 min-w-0">
                                <span className="font-bold mr-1">{replyTo.profiles?.username}:</span>
                                <span className="text-muted-foreground truncate">{replyTo.content}</span>
                            </div>
                            <button onClick={() => setReplyTo(null)} className="hover:text-red-500"><X className="h-3 w-3"/></button>
                        </div>
                    )}
                    {attachment && (
                         <div className="flex-1 flex items-center gap-2 text-xs bg-background border rounded px-2 py-1.5">
                            <Paperclip className="h-3 w-3 text-primary" />
                            <span className="flex-1 truncate text-muted-foreground">{attachment.name}</span>
                            <button onClick={() => { setAttachment(null); setFileInputKey(Date.now()); }} className="hover:text-red-500"><X className="h-3 w-3"/></button>
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-end gap-2 p-2">
                {/* Left Actions */}
                <div className="flex gap-1 pb-1">
                    <input
                        key={fileInputKey}
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                                setAttachment(f);
                                toast.success("File attached");
                            }
                        }}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full" onClick={() => (fileInputRef.current as HTMLInputElement)?.click()}>
                        <Paperclip className="h-4 w-4" />
                    </Button>
                    
                    {/* Emoji Button & Popover */}
                    <div className="relative">
                        <Button 
                            ref={emojiBtnRef}
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
                            onClick={() => showEmojiPopup ? closeEmojiPortal() : openEmojiPortal()}
                        >
                            <span className="text-lg leading-none">☺</span>
                        </Button>
                        
                        {showEmojiPopup && emojiPortalPos && createPortal(
                            <div
                                ref={emojiPortalRef}
                                className="fixed bg-popover text-popover-foreground p-2 rounded-lg shadow-xl z-[9999] border grid grid-cols-6 gap-1 w-64 animate-in fade-in zoom-in-95 duration-200"
                                style={{ left: emojiPortalPos.left, top: emojiPortalPos.top - 200 }} // Adjust top to show above
                            >
                                {EMOJIS.concat(["😄", "😉", "😅", "🤩", "✨", "💫"]).map((e) => (
                                    <button key={e} className="p-1.5 hover:bg-muted rounded text-xl" onClick={() => {
                                        setNewMessage((s) => (s ? `${s} ${e}` : e));
                                        closeEmojiPortal();
                                        textareaRef.current?.focus();
                                    }}>{e}</button>
                                ))}
                            </div>, document.body
                        )}
                    </div>

                    {/* GIF Button */}
                    <div className="relative">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full" onClick={() => { setShowGifPopup(!showGifPopup); setGifResults([]); setGifQuery(""); }}>
                            <span className="text-[10px] font-bold border border-current rounded px-0.5">GIF</span>
                        </Button>

                        {showGifPopup && (
                            <div ref={gifPopupRef} className="absolute bottom-10 left-0 w-80 bg-popover border shadow-xl rounded-lg p-3 z-50">
                                <div className="flex gap-2 mb-2">
                                    <input className="flex-1 bg-muted rounded px-2 py-1 text-sm outline-none" placeholder="Search Tenor..." value={gifQuery} onChange={(e) => setGifQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchGifs(gifQuery)} />
                                </div>
                                <div className="h-48 overflow-y-auto grid grid-cols-3 gap-2">
                                    {gifLoading && <p className="text-xs text-muted-foreground col-span-3 text-center py-4">Loading...</p>}
                                    {gifResults.map((g) => (
                                        <img key={g.id} src={g.url} className="h-16 w-full object-cover rounded cursor-pointer hover:opacity-80" onClick={() => sendGif(g.url)} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Text Area */}
                <Textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => onMessageChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder="Type your message..."
                    className="flex-1 min-h-[40px] max-h-[120px] bg-transparent border-0 focus-visible:ring-0 resize-none py-2 px-0 text-sm shadow-none"
                    rows={1}
                />

                {/* Send Button */}
                <Button 
                    onClick={handleSendMessage} 
                    size="icon" 
                    className="h-8 w-8 mb-1 rounded-full shrink-0 transition-all hover:scale-105"
                    disabled={!newMessage.trim() && !attachment}
                >
                    <Send className="h-4 w-4 ml-0.5" />
                </Button>
            </div>
        </div>
      </div>

      {/* --- PREVIEW DIALOG --- */}
      <Dialog open={!!openPreviewUrl} onOpenChange={(o) => !o && setOpenPreviewUrl(null)}>
        <DialogContent className="max-w-3xl w-full p-0 overflow-hidden bg-black/95 border-0 text-white">
            <div className="relative flex items-center justify-center h-[80vh]">
                {openPreviewUrl && <img src={openPreviewUrl} alt="preview" className="max-w-full max-h-full object-contain" />}
                <button onClick={() => setOpenPreviewUrl(null)} className="absolute top-4 right-4 p-2 bg-black/50 rounded-full hover:bg-white/20"><X className="h-5 w-5 text-white" /></button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default GroupChat;
