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
        console.log("Fetched messages:", data);
      if (error) {
        console.error("fetchMessages error", error);
        toast.error("Failed to fetch messages");
        return;
      }
      const enriched = await Promise.all(
        (data || []).map(async (m: any) => {
        if (m.reply_to) {
          const { data: replied } = await supabase
          .from("messages")
          .select("id, content, profiles:profiles!fk_messages_profiles_user_id (username, full_name)")
          .eq("id", m.reply_to)
          .single();

          return {
            ...m,
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
          return m;
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
        const { data: statusData } = await supabase.from("user_status").select("user_id, online").in("user_id", (data || []).map((d: any) => d.id));
        const map: Record<string, boolean> = {};
        (statusData || []).forEach((r: any) => (map[r.user_id] = !!r.online));
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
        emojiPopupRef.current?.contains(target) ||
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
      (data || []).forEach((r: any) => {
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
    const reactions = Array.isArray(msg.reactions) ? [...msg.reactions] : [];

    const existing = reactions.find((r: any) => r.emoji === emoji);
    if (existing) {
      if (existing.user_ids.includes(userId)) {
        existing.user_ids = existing.user_ids.filter((id: string) => id !== userId);
        if (existing.user_ids.length === 0) {
          const idx = reactions.findIndex((r: any) => r.emoji === emoji);
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

      const results = (json.results || []).map((r: any) => {
        // Prefer gif, mediumgif, tinygif
        const url = r.media_formats?.gif?.url || r.media_formats?.mediumgif?.url || r.media_formats?.tinygif?.url;
        return { id: r.id, url };
      });

      setGifResults(results.filter((r) => r.url));
      if ((results.filter((r) => r.url)).length === 0) {
        setGifError("No GIFs found for that search.");
      }
    } catch (err: any) {
      console.error("searchGifs error", err);
      setGifError(err?.message || "Failed to fetch GIFs");
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Community Chat</h2>
          <p className="text-sm text-muted-foreground">Connect with fellow members in real-time</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-muted-foreground">
            {Object.keys(typingUsersMap)
              .filter((uid) => uid !== userId && Date.now() - (typingUsersMap[uid] || 0) < 6000).length > 0 ? (
              <span>
                {Object.keys(typingUsersMap)
                  .filter((uid) => uid !== userId && Date.now() - (typingUsersMap[uid] || 0) < 6000)
                  .map((uid) => {
                    const u = users.find((x) => x.id === uid);
                    return u ? (u.full_name || u.username) : uid;
                  })
                  .slice(0, 3)
                  .join(", ")}{" "}
                typing...
              </span>
            ) : (
              <span className="opacity-60">no one typing</span>
            )}
          </div>
        </div>
      </div>

      <Card
        className="shadow-card h-[700px] flex flex-col bg-cover bg-center bg-no-repeat"
        style={{
        backgroundImage: "url('/src/assets/logo.png')",
        backgroundColor: "#f2f3f5",
        backgroundBlendMode: "overlay",
        }}
      >

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-6">
          {groupedWithDates().map((group) => (
            <div key={group.dateHeader}>
              <div className="text-center my-2">
                <Badge variant="outline">{group.dateHeader}</Badge>
              </div>

              {group.messages.map((message) => {
                const mine = message.user_id === userId;

                if (message.is_deleted) {
                  return (
                    <div key={message.id} className={`flex ${mine ? "flex-row-reverse" : "flex-row"} gap-3`}>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={`${avatarColorFromId(message.user_id)} text-white`}>
                          {message.profiles?.username?.charAt(0)?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`flex flex-col max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
                        <div className="rounded-lg p-3 bg-gray-300 text-sm italic opacity-80">Message deleted</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={message.id}
                    onMouseEnter={() => setHoveredMessageId(message.id)}
                    onMouseLeave={() => setHoveredMessageId((id) => (id === message.id ? null : id))}
                    className={`relative flex gap-3 ${mine ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={`${avatarColorFromId(message.user_id)} text-white`}>
                        {message.profiles?.username?.charAt(0)?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>

                    {/* Make this container relative so the inline hover area positions correctly */}
                    <div className={`relative flex flex-col max-w-[75%] ${mine ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">{message.profiles?.full_name || message.profiles?.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(message.created_at), "hh:mm a")}
                          {message.edited ? " • edited" : ""}
                          {onlineMap[message.user_id] ? " • online" : ""}
                        </span>
                      </div>

                      <div className={`relative rounded-lg p-3 ${mine ? "bg-emerald-500 text-white" : "bg-white text-black"}`} style={mine ? { background: "#10b981" } : undefined}>
                        {message.replied_message && (
                          <div className={`mb-2 p-2 rounded ${mine ? "bg-white/10" : "bg-gray-50"} border-l-2 border-emerald-600`}>
                            <p className="text-xs font-medium">Replying to {message.replied_message.profiles?.username ?? "someone"}</p>
                            <p className="text-xs opacity-80 truncate">{message.replied_message.content}</p>
                          </div>
                        )}

                        {editingMessageId === message.id ? (
                          <div className="space-y-2">
                            <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={3} className="text-black" />
                            <div className="flex gap-2 justify-end">
                              <Button onClick={() => { setEditingMessageId(null); setEditingText(""); }} variant="ghost">Cancel</Button>
                              <Button onClick={submitEdit}>Save</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

                            {message.attachment_url && (
                              <div className="mt-2 rounded overflow-hidden border bg-background/30">
                                {/\.(png|jpe?g|webp|gif)$/i.test(message.attachment_name || "") ? (
                                  <img src={message.attachment_url!} alt={message.attachment_name} className="max-h-64 object-contain w-full cursor-pointer" onClick={() => openPreview(message.attachment_url!)} />
                                ) : (
                                  <div className="flex items-center gap-2 p-2">
                                    <Paperclip className="h-4 w-4" />
                                    <div className="flex-1 truncate">{message.attachment_name}</div>
                                    <a href={message.attachment_url!} download={message.attachment_name} target="_blank" rel="noreferrer noopener">
                                      <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="mt-2 flex gap-2 items-center">
                              {(message.reactions || []).map((r: any) => (
                                <button
                                  key={r.emoji}
                                  className={`px-2 py-1 rounded-full text-sm border ${r.user_ids?.includes(userId) ? "bg-black/10" : "bg-gray-100"}`}
                                  onClick={() => toggleReaction(message.id, r.emoji)}
                                  title={`${r.user_ids?.length || 0} reactions`}
                                >
                                  <span className="mr-1">{r.emoji}</span>
                                  <span className="text-xs">{r.user_ids?.length || 0}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        {/* inline hover area (emoji + menu) */}
                        <div className={`absolute top-1 ${mine ? "-left-11" : "-right-11"} transition-opacity ${hoveredMessageId === message.id ? "opacity-100" : "opacity-0"} z-50`}>
                          <div className="flex flex-col items-center gap-1">
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="p-1 rounded-full bg-black shadow-sm hover:scale-105 transition" title="More">
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-2">
                                <PopupCard>
                                  <PopupContent>
                                    <div className="space-y-1">
                                      {message.user_id === userId && (
                                        <>
                                          <button className="w-full text-left px-2 py-2 hover:bg-muted rounded flex items-center gap-2" onClick={() => startEdit(message)}>
                                            <Edit2 className="h-4 w-4" /> Edit
                                          </button>
                                          <button className="w-full text-left px-2 py-2 hover:bg-muted rounded flex items-center gap-2" onClick={() => deleteMessage(message)}>
                                            <Trash2 className="h-4 w-4" /> Delete
                                          </button>
                                          <button
                                            className="w-full text-left px-2 py-2 hover:bg-muted rounded flex items-center gap-2"
                                            onClick={() => toast(`Seen by: ${seenByNames(message.seen_by)}`)}
                                          >
                                            <Eye className="h-4 w-4" /> Seen by
                                          </button>
                                        </>
                                      )}
                                    

                                      <div className="border-t my-2" />

                                      <div className="text-sm mb-2">React</div>
                                      <div className="flex gap-2 flex-wrap mb-2">
                                        {EMOJIS.map((emoji) => (
                                          <button key={emoji} className="px-2 py-1 rounded" onClick={() => toggleReaction(message.id, emoji)}>{emoji}</button>
                                        ))}
                                      </div>
                                    </div>
                                  </PopupContent>
                                </PopupCard>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-1 items-center">
                        {!mine && (
                          <Button size="sm" variant="ghost" onClick={() => setReplyTo(message)}>
                            <Reply className="h-3 w-3 mr-1" /> Reply
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
        </CardContent>

        {/* typing indicator */}
        <div className="px-4">
          <div className="text-xs text-muted-foreground mb-2">
            {Object.keys(typingUsersMap)
              .filter((uid) => uid !== userId && Date.now() - (typingUsersMap[uid] || 0) < 6000).length > 0 ? (
              <span>
                {Object.keys(typingUsersMap)
                  .filter((uid) => uid !== userId && Date.now() - (typingUsersMap[uid] || 0) < 6000)
                  .map((uid) => {
                    const u = users.find((x) => x.id === uid);
                    return u ? (u.full_name || u.username) : uid;
                  })
                  .slice(0, 3)
                  .join(", ")}{" "}
                typing...
              </span>
            ) : (
              <span className="opacity-60">no one typing</span>
            )}
          </div>
        </div>

        {/* composer */}
        <div className="border-t p-4 space-y-2 bg-white">
          {replyTo && (
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <Reply className="h-4 w-4" />
              <div className="flex-1">
                <p className="text-xs font-medium">Replying to {replyTo.profiles?.username}</p>
                <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
              </div>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setReplyTo(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {attachment && (
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <Paperclip className="h-4 w-4" />
              <span className="text-xs flex-1 truncate">{attachment.name}</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setAttachment(null); setFileInputKey(Date.now()); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex gap-2 items-end">
            <input
              key={fileInputKey}
              ref={fileInputRef as any}
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
            <Button size="icon" variant="outline" onClick={() => (fileInputRef.current as HTMLInputElement)?.click()}><Paperclip className="h-4 w-4" /></Button>

            {/* emoji and gif buttons left of textarea */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  ref={emojiBtnRef}
                  onClick={() => {
                    if (showEmojiPopup) closeEmojiPortal();
                    else openEmojiPortal();
                  }}
                  className="p-2 rounded-full bg-white shadow-sm hover:scale-105 transition"
                >
                  <span style={{ fontSize: 18 }}>🤠</span>
                </button>

                {/* Emoji portal - positioned near the button */}
                {showEmojiPopup && emojiPortalPos &&
                  createPortal(
                    <div
                      ref={emojiPortalRef}
                      className="fixed bg-white p-3 rounded-lg shadow-lg z-[999] grid grid-cols-6 gap-2 border border-gray-100"
                      style={{ left: emojiPortalPos.left, top: emojiPortalPos.top, maxWidth: 360 }}
                    >
                      {EMOJIS.concat(["😄", "😉", "😅", "🤩", "✨", "💫"]).map((e) => (
                        <button
                          key={e}
                          className="p-1 text-lg hover:bg-gray-100 rounded-md transition"
                          onClick={() => {
                            setNewMessage((s) => (s ? `${s} ${e}` : e));
                            closeEmojiPortal();
                            textareaRef.current?.focus();
                          }}
                        >
                          {e}
                        </button>
                      ))}
                    </div>,
                    document.body
                  )}

              </div>

              <div className="relative">
                <button onClick={() => { setShowGifPopup((s) => !s); setGifResults([]); setGifQuery(""); }} className="p-2 rounded-full bg-white shadow-sm" title="GIF">
                  🎞️
                </button>

                {showGifPopup && (
                  <div className="absolute bottom-12 left-0 bg-white rounded-md shadow p-3 w-96 z-50">
                    <div className="flex gap-2 mb-2">
                      <input
                        className="flex-1 border rounded px-2 py-1"
                        placeholder="Search GIFs"
                        value={gifQuery}
                        onChange={(e) => setGifQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            searchGifs(gifQuery);
                          }
                        }}
                      />
                      <Button onClick={() => searchGifs(gifQuery)}>Search</Button>
                    </div>

                    <div className="h-48 overflow-auto">
                      {gifLoading && <div className="text-xs text-muted-foreground">Loading...</div>}
                      {gifError && <div className="text-xs text-red-500">{gifError}</div>}

                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {gifResults.map((g) => (
                          <img key={g.id} src={g.url} className="h-20 w-full object-cover rounded cursor-pointer" onClick={() => sendGif(g.url)} />
                        ))}
                        {!gifLoading && gifResults.length === 0 && !gifError && (
                          <div className="col-span-4 text-xs text-muted-foreground">Type and press Enter to search GIFs (Tenor key required).</div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end mt-2"><Button variant="ghost" onClick={() => setShowGifPopup(false)}>Close</Button></div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => onMessageChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
                }}
                placeholder="Type a message... (Shift+Enter for newline)"
                className="min-h-[48px] max-h-[160px] resize-none"
                rows={1}
              />
            </div>

            <div>
              <Button onClick={handleSendMessage} className="gap-2 bg-black text-white">
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* preview modal */}
      <Dialog open={!!openPreviewUrl} onOpenChange={(o) => { if (!o) setOpenPreviewUrl(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Preview</DialogTitle></DialogHeader>
          <div className="w-full max-h-[70vh] overflow-auto">
            {openPreviewUrl && <img src={openPreviewUrl} alt="preview" className="w-full object-contain" />}
            <div className="mt-4 flex gap-2">
              <a href={openPreviewUrl || ""} download target="_blank" rel="noreferrer"><Button><Download className="h-4 w-4" /> Download</Button></a>
              <Button variant="ghost" onClick={() => setOpenPreviewUrl(null)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupChat;
