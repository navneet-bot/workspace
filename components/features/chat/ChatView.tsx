"use client";

import { useState, useEffect, useRef } from "react";
import { 
  fetchChatMessages, 
  sendChatMessage, 
  deleteChatMessage,
  fetchGroupMessages, 
  sendGroupMessage, 
  deleteGroupMessage,
  fetchConversations,
  markMessagesAsRead,
  deleteConversation
} from "@/app/actions/chat";
import { deleteGroup, renameGroup } from "@/app/actions/groups";
import { Search, Paperclip, Send, MessageSquare, Pin, Trash2, Smile, Edit2 } from "lucide-react";
import { useUIStore } from "@/hooks/useUIStore";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Group {
  id: number;
  name: string;
  description: string;
  icon: string;
  members: string; // JSON list of emails
  createdBy: string | null;
  createdAt: string;
}

interface Contact {
  id: string; // e.g. "user_1" or "group_1" or "mock_-99"
  dbId: number;
  name: string;
  email: string;
  role: string; // "admin" | "super_admin" | "intern" | "group" | "channel"
  isGroup: boolean;
  icon?: string;
}

interface Message {
  id: number;
  senderId?: number; // for direct
  receiverId?: number; // for direct
  sender?: string; // for group (email)
  message: string;
  sentAt: string;
}

export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="flex items-center justify-center shrink-0 ml-[12px]">
      <div className="min-w-[24px] h-[24px] px-[8px] rounded-full bg-[#10B981] text-white text-[12px] font-bold flex items-center justify-center">
        {count > 99 ? "99+" : count}
      </div>
    </div>
  );
}

export function ChatView({
  currentUser,
  users,
  groups,
  initialSelectedContactId,
  activeUserEmails = [],
}: {
  currentUser: { id: number; role: string; email: string };
  users: User[];
  groups: Group[];
  initialSelectedContactId?: string | null;
  activeUserEmails?: string[];
}) {
  const { addToast } = useUIStore();
  const [search, setSearch] = useState("");
  
  // Contacts state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  
  // Chat messaging states
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typingContact, setTypingContact] = useState<string | null>(null);
  
  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  
  // Custom right-click pin context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; contactId: string } | null>(null);
  const [pinnedContactIds, setPinnedContactIds] = useState<string[]>([]);
  
  // Real-time conversations metadata
  const [conversationsMeta, setConversationsMeta] = useState<Record<string, { unreadCount: number, lastMessageAt: string, lastMessagePreview: string }>>({});
  
  // Emoji popup state
  const [emojiPopupOpen, setEmojiPopupOpen] = useState(false);
  
  const router = useRouter();

  // Rename states
  const [renameContact, setRenameContact] = useState<Contact | null>(null);
  const [newNameInput, setNewNameInput] = useState("");

  // Delete states
  const [deleteContactTarget, setDeleteContactTarget] = useState<Contact | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedContactRef = useRef<Contact | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"];

  // Initialize contacts list including both DB users, DB groups, and the original general/marketing mock channels
  useEffect(() => {
    // 1. Map users
    const userContacts: Contact[] = users
      .filter((u) => u.id !== currentUser.id)
      .map((u) => {
        const contactId = `user_${u.id}`;
        const savedNickname = typeof window !== "undefined"
          ? localStorage.getItem(`chat_nickname_${currentUser.id}_${contactId}`)
          : null;
        return {
          id: contactId,
          dbId: u.id,
          name: savedNickname || u.name,
          email: u.email,
          role: u.role,
          isGroup: false
        };
      });

    // 2. Map actual DB groups
    const dbGroupContacts: Contact[] = groups.map((g) => ({
      id: `group_${g.id}`,
      dbId: g.id,
      name: g.name,
      email: `${g.name.toLowerCase().replace(/\s+/g, "")}@jobjockey.in`,
      role: "group",
      isGroup: true,
      icon: g.icon
    }));

    // 3. Add mock groups matching original HTML
    const mockGroupContacts: Contact[] = [];

    // Combine them, deduping by email
    const allCombined = [...mockGroupContacts, ...dbGroupContacts, ...userContacts];
    const uniqueCombined: Contact[] = [];
    const seenEmails = new Set<string>();

    allCombined.forEach((c) => {
      if (!seenEmails.has(c.email)) {
        seenEmails.add(c.email);
        uniqueCombined.push(c);
      }
    });

    setContacts(uniqueCombined);

    // Load pins from localStorage
    const savedPins = localStorage.getItem(`pinned_chats_${currentUser.id}`);
    if (savedPins) {
      try { setPinnedContactIds(JSON.parse(savedPins)); } catch {}
    }
  }, [users, groups, currentUser.id]);

  // Fetch conversation metadata periodically
  useEffect(() => {
    if (contacts.length === 0) return;
    
    const loadMeta = async () => {
      const dbMeta = await fetchConversations(currentUser.id, currentUser.email);
      const meta = { ...dbMeta };

      // Force selected contact to have 0 unreadCount to avoid race condition overriding optimistic UI update
      if (selectedContactRef.current) {
        const selId = selectedContactRef.current.id;
        if (meta[selId]) {
          meta[selId].unreadCount = 0;
        }
      }

      // Append mock local channels
      contacts.filter(c => c.id.startsWith("mock_")).forEach(c => {
        const localLogs = localStorage.getItem(`mock_msgs_${c.id}`);
        const msgs = localLogs ? JSON.parse(localLogs) : [];
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          meta[c.id] = {
            unreadCount: 0,
            lastMessageAt: lastMsg.sentAt,
            lastMessagePreview: lastMsg.message
          };
        }
      });
      
      setConversationsMeta(prev => {
        // Only update if there's an actual change to avoid rerenders
        if (JSON.stringify(prev) !== JSON.stringify(meta)) return meta;
        return prev;
      });
    };

    loadMeta();
    const interval = setInterval(loadMeta, 4000);
    return () => clearInterval(interval);
  }, [contacts, currentUser.id, currentUser.email]);

  useEffect(() => {
    if (initialSelectedContactId && contacts.length > 0) {
      const match = contacts.find((c) => c.id === initialSelectedContactId);
      if (match) {
        setSelectedContact(match);
      }
    }
  }, [initialSelectedContactId, contacts]);

  // Load chat messages when a contact is chosen
  const loadMessages = async (contact: Contact, keepBottom = true) => {
    let msgs: Message[] = [];
    if (contact.isGroup) {
      // Mock general & marketing logs can read local storage or fetch if dbId is valid
      if (contact.id.startsWith("mock_")) {
        const localLogs = localStorage.getItem(`mock_msgs_${contact.id}`);
        msgs = localLogs ? JSON.parse(localLogs) : [];
      } else {
        const dbMsgs = await fetchGroupMessages(contact.dbId);
        msgs = dbMsgs.map((m: any) => ({
          id: m.id,
          sender: m.sender,
          message: m.message,
          sentAt: m.sentAt
        }));
      }
    } else {
      const dbMsgs = await fetchChatMessages(currentUser.id, contact.dbId);
      msgs = dbMsgs.map((m: any) => ({
        id: m.id,
        senderId: m.senderId,
        receiverId: m.receiverId,
        message: m.message,
        sentAt: m.sentAt
      }));
    }
    setMessages(msgs);
    if (keepBottom) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }

    // Mark as read in DB if this is the active contact
    if (selectedContactRef.current && contact.id === selectedContactRef.current.id) {
      markMessagesAsRead(contact.id, currentUser.id).then(() => {
        console.log("messages marked read");
      });
    }
  };

  useEffect(() => {
    selectedContactRef.current = selectedContact;
    if (selectedContact) {
      // Clear unread count immediately in UI (synchronously)
      setConversationsMeta(prev => ({
        ...prev,
        [selectedContact.id]: {
          ...(prev[selectedContact.id] || { lastMessageAt: "", lastMessagePreview: "" }),
          unreadCount: 0
        }
      }));

      loadMessages(selectedContact);
    }
  }, [selectedContact]);

  // Periodic messages sync to simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedContact) {
        loadMessages(selectedContact, false);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedContact]);

  // Scroll to bottom helper
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingContact]);

  // Outside clicks emoji
  useEffect(() => {
    const handleEmojiOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiPopupOpen(false);
      }
    };
    document.addEventListener("mousedown", handleEmojiOutside);
    return () => document.removeEventListener("mousedown", handleEmojiOutside);
  }, []);

  // Update contact activity timestamp and reorder contacts
  const updateContactActivity = (contactId: string, preview: string) => {
    const newTs = new Date().toISOString();
    setConversationsMeta(prev => ({
      ...prev,
      [contactId]: {
        ...(prev[contactId] || { unreadCount: 0 }),
        lastMessageAt: newTs,
        lastMessagePreview: preview
      }
    }));
  };

  // Reorder and filter contacts
  const getSortedContacts = () => {
    const priority: Record<string, number> = { admin: 3, super_admin: 2, intern: 1, group: 0, channel: 0 };
    const hiddenChats: string[] = typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem(`hidden_chats_${currentUser.id}`) || "[]")
      : [];
    
    return [...contacts]
      .filter((c) => {
        if (!c.name.toLowerCase().includes(search.toLowerCase())) return false;
        
        if (hiddenChats.includes(c.id)) {
          const meta = conversationsMeta[c.id];
          if (meta && meta.unreadCount > 0) {
            const updated = hiddenChats.filter((id) => id !== c.id);
            localStorage.setItem(`hidden_chats_${currentUser.id}`, JSON.stringify(updated));
            return true;
          }
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aPinned = pinnedContactIds.includes(a.id);
        const bPinned = pinnedContactIds.includes(b.id);
        
        // 1. Pinned first
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        // 2. Last activity timestamp
        const tsA = conversationsMeta[a.id]?.lastMessageAt ? new Date(conversationsMeta[a.id].lastMessageAt).getTime() : 0;
        const tsB = conversationsMeta[b.id]?.lastMessageAt ? new Date(conversationsMeta[b.id].lastMessageAt).getTime() : 0;
        if (tsA !== tsB) return tsB - tsA;

        // 3. Fallback role hierarchy
        const roleA = priority[a.role] || 0;
        const roleB = priority[b.role] || 0;
        if (roleA !== roleB) return roleB - roleA;

        return a.name.localeCompare(b.name);
      });
  };

  // Pinned toggle
  const togglePin = (contactId: string) => {
    let updated: string[];
    if (pinnedContactIds.includes(contactId)) {
      updated = pinnedContactIds.filter((id) => id !== contactId);
      addToast("Chat unpinned", "info");
    } else {
      updated = [...pinnedContactIds, contactId];
      addToast("Chat pinned", "success");
    }
    setPinnedContactIds(updated);
    localStorage.setItem(`pinned_chats_${currentUser.id}`, JSON.stringify(updated));
    setContextMenu(null);
  };

  // Right click trigger
  const handleContextMenu = (e: React.MouseEvent, contactId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      contactId
    });
  };

  useEffect(() => {
    const closeContext = () => setContextMenu(null);
    document.addEventListener("click", closeContext);
    return () => document.removeEventListener("click", closeContext);
  }, []);

  const handleRename = async (contact: Contact, newName: string) => {
    if (!newName.trim()) return;
    if (contact.isGroup) {
      const res = await renameGroup(contact.dbId, newName);
      if (res.success) {
        setContacts((prev) => prev.map((c) => c.id === contact.id ? { ...c, name: newName } : c));
        if (selectedContact?.id === contact.id) {
          setSelectedContact((prev) => prev ? { ...prev, name: newName } : null);
        }
        addToast("Group renamed successfully", "success");
        router.refresh();
      } else {
        addToast(res.error || "Failed to rename group", "error");
      }
    } else {
      localStorage.setItem(`chat_nickname_${currentUser.id}_${contact.id}`, newName);
      setContacts((prev) => prev.map((c) => c.id === contact.id ? { ...c, name: newName } : c));
      if (selectedContact?.id === contact.id) {
        setSelectedContact((prev) => prev ? { ...prev, name: newName } : null);
      }
      addToast("Contact nickname updated", "success");
    }
  };

  const handleDelete = async (contact: Contact) => {
    if (contact.isGroup) {
      const res = await deleteGroup(contact.dbId);
      if (res.success) {
        setContacts((prev) => prev.filter((c) => c.id !== contact.id));
        if (selectedContact?.id === contact.id) {
          setSelectedContact(null);
          setMessages([]);
        }
        addToast("Group deleted successfully", "success");
        router.refresh();
      } else {
        addToast(res.error || "Failed to delete group", "error");
      }
    } else {
      const res = await deleteConversation(currentUser.id, contact.dbId);
      if (res.success) {
        const hidden: string[] = typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem(`hidden_chats_${currentUser.id}`) || "[]")
          : [];
        if (!hidden.includes(contact.id)) {
          hidden.push(contact.id);
          localStorage.setItem(`hidden_chats_${currentUser.id}`, JSON.stringify(hidden));
        }
        setContacts((prev) => prev.filter((c) => c.id !== contact.id));
        if (selectedContact?.id === contact.id) {
          setSelectedContact(null);
          setMessages([]);
        }
        addToast("Conversation history deleted", "success");
      } else {
        addToast(res.error || "Failed to delete conversation", "error");
      }
    }
  };

  // Send Message
  const handleSend = async (customMsg?: string) => {
    const textToSend = (customMsg || msgInput).trim();
    if (!textToSend || !selectedContact) return;

    // Unhide contact if it was hidden
    const hiddenChats: string[] = typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem(`hidden_chats_${currentUser.id}`) || "[]")
      : [];
    if (hiddenChats.includes(selectedContact.id)) {
      const updated = hiddenChats.filter((id) => id !== selectedContact.id);
      localStorage.setItem(`hidden_chats_${currentUser.id}`, JSON.stringify(updated));
    }

    if (!customMsg) setMsgInput("");
    setLoading(true);

    if (selectedContact.isGroup) {
      if (selectedContact.id.startsWith("mock_")) {
        // Mock send
        const newMsg: Message = {
          id: Date.now() + Math.random(),
          sender: currentUser.email,
          message: textToSend,
          sentAt: new Date().toISOString()
        };
        const localLogs = localStorage.getItem(`mock_msgs_${selectedContact.id}`);
        const currentLogs = localLogs ? JSON.parse(localLogs) : [];
        const newLogs = [...currentLogs, newMsg];
        localStorage.setItem(`mock_msgs_${selectedContact.id}`, JSON.stringify(newLogs));
        setMessages(newLogs);
      } else {
        // DB Group message
        await sendGroupMessage(selectedContact.dbId, currentUser.email, textToSend);
        await loadMessages(selectedContact);
      }
    } else {
      // DB User message
      await sendChatMessage(currentUser.id, selectedContact.dbId, textToSend);
      await loadMessages(selectedContact);
    }

    updateContactActivity(selectedContact.id, textToSend);
    setLoading(false);

  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addEmoji = (emoji: string) => {
    setMsgInput((prev) => prev + emoji);
    setEmojiPopupOpen(false);
  };

  // Upload attachments
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContact) return;

    const isImg = /^image\//.test(file.type);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isImg && !isPdf) {
      addToast("Only images and PDFs are supported", "error");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      addToast("File too large — max 8 MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUri = event.target?.result as string;
      const prefix = isImg ? `[img:${file.name}]` : `[file:${file.name}]`;
      await handleSend(prefix + dataUri);
      addToast("Attachment uploaded successfully!", "success");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Delete message
  const handleDeleteMsg = async (msgId: number) => {
    if (!selectedContact) return;
    if (selectedContact.isGroup) {
      if (selectedContact.id.startsWith("mock_")) {
        const localLogs = localStorage.getItem(`mock_msgs_${selectedContact.id}`);
        const currentLogs = localLogs ? JSON.parse(localLogs) : [];
        const newLogs = currentLogs.filter((m: any) => m.id !== msgId);
        localStorage.setItem(`mock_msgs_${selectedContact.id}`, JSON.stringify(newLogs));
        setMessages(newLogs);
      } else {
        await deleteGroupMessage(msgId);
        await loadMessages(selectedContact);
      }
    } else {
      await deleteChatMessage(msgId);
      await loadMessages(selectedContact);
    }
    addToast("Message deleted", "info");
  };

  // Lightbox overlay close esc handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxSrc(null);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  // Format message text
  const renderMessageText = (msg: string) => {
    if (msg.startsWith("[img:")) {
      const idx = msg.indexOf("]");
      const name = msg.slice(5, idx);
      const data = msg.slice(idx + 1);
      return (
        <div className="space-y-1">
          <img
            src={data}
            alt={name}
            onClick={() => setLightboxSrc(data)}
            className="max-h-[160px] max-w-[220px] cursor-zoom-in rounded-lg object-cover block border border-jj-border"
          />
          <span className="text-[11px] text-jj-text-muted block max-w-[220px] truncate">{name}</span>
        </div>
      );
    }

    if (msg.startsWith("[file:")) {
      const idx = msg.indexOf("]");
      const name = msg.slice(6, idx);
      const data = msg.slice(idx + 1);
      const isPdf = name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        return (
          <div className="flex items-center gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 p-2 px-3.5 min-w-[180px]">
            <span className="text-[26px]">📄</span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-jj-text truncate max-w-[140px]">{name}</div>
              <div className="mt-1 flex gap-3 text-[11px] font-bold text-jj-accent">
                <a href={data} target="_blank" rel="noopener noreferrer" className="hover:underline">View</a>
                <a href={data} download={name} className="hover:underline">Download</a>
              </div>
            </div>
          </div>
        );
      }

      return (
        <a
          href={data}
          download={name}
          className="flex items-center gap-2 font-medium text-jj-accent text-[13px] hover:underline"
        >
          <Paperclip size={14} />
          {name}
        </a>
      );
    }

    // Linkify urls
    const esc = msg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const linkified = esc.replace(
      /(https?:\/\/[^\s<>"&]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-jj-accent underline break-all">$1</a>'
    );
    return <div dangerouslySetInnerHTML={{ __html: linkified }} />;
  };

  const sortedContactsList = getSortedContacts();

  return (
    <div className="chat-layout h-[calc(100vh-140px)] min-h-[480px] overflow-hidden rounded-[14px] border border-jj-border bg-jj-surface">
      {/* Sidebar contact list */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header flex items-center justify-between">
          <span>💬 Messages</span>
        </div>
        
        <div className="chat-search">
          <input
            type="text"
            placeholder="🔍 Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface2 border border-border"
          />
        </div>

        <div className="chat-list">
          {sortedContactsList.length === 0 ? (
            <div className="p-5 text-center text-jj-text-muted text-[13px]">
              No contacts found
            </div>
          ) : (
            sortedContactsList.map((c, i) => {
              const color = COLORS[c.dbId % COLORS.length] || "#f59e0b";
              const isActive = selectedContact?.id === c.id;
              const isPinned = pinnedContactIds.includes(c.id);
              const meta = conversationsMeta[c.id] || { unreadCount: 0, lastMessagePreview: "" };
              
              const conversation = {
                id: c.id,
                unreadCount: meta.unreadCount
              };

              console.log("conversation", conversation.id);
              console.log("unreadCount", conversation.unreadCount);

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedContact(c)}
                  onContextMenu={(e) => handleContextMenu(e, c.id)}
                  className={`chat-contact relative w-full box-border flex items-center justify-between !px-[16px] !py-[14px] !gap-0 ${isActive ? "active" : ""}`}
                >
                  <div className="flex items-center gap-[14px] flex-1 min-w-0">
                    <div
                      className="cav relative flex items-center justify-center text-[13px] font-bold shrink-0"
                      style={{ backgroundColor: `${color}22`, color, borderColor: `${color}44` }}
                    >
                      {c.isGroup ? c.icon || "👥" : c.name.slice(0, 2).toUpperCase()}
                      {!c.isGroup && (
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-jj-surface rounded-full ${
                          activeUserEmails.includes(c.email) ? "bg-jj-green" : "bg-jj-text-muted"
                        }`} />
                      )}
                    </div>

                    <div className="flex flex-col flex-1 min-w-0">
                      <div className={`flex items-center gap-1 text-[13.5px] truncate ${conversation.unreadCount > 0 ? "font-bold text-jj-text" : "font-medium text-jj-text-soft"}`}>
                        {isPinned && <Pin size={12} className="text-jj-accent fill-jj-accent shrink-0 rotate-45" />}
                        <span className="truncate">{c.name}</span>
                      </div>
                      <div className={`text-[12px] truncate mt-1 ${conversation.unreadCount > 0 ? "text-jj-text font-bold" : "text-jj-text-soft"}`}>
                        {meta.lastMessagePreview || c.role}
                      </div>
                    </div>
                  </div>

                  <UnreadBadge count={conversation.unreadCount} />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main chat window */}
      <div className="chat-area">
        {selectedContact ? (
          <>
            {/* Header info */}
            <div className="chat-header">
              {(() => {
                const color = COLORS[selectedContact.dbId % COLORS.length] || "#f59e0b";
                return (
                  <div
                    className="cav flex items-center justify-center text-[13px] font-bold border-2"
                    style={{ backgroundColor: `${color}22`, color, borderColor: `${color}44` }}
                  >
                    {selectedContact.isGroup ? selectedContact.icon || "👥" : selectedContact.name.slice(0, 2).toUpperCase()}
                  </div>
                );
              })()}
              <div className="chat-header-info">
                <div className="cn text-[14px] font-bold text-jj-text">{selectedContact.name}</div>
                {selectedContact.isGroup ? (
                  <div className="cs text-[12px] text-jj-text-soft font-medium">
                    👥 {(() => {
                      const group = groups.find(g => g.id === selectedContact.dbId);
                      if (group) {
                        try {
                          const parsed = JSON.parse(group.members || "[]");
                          const count = Array.isArray(parsed) ? parsed.length : 0;
                          return `${count} ${count === 1 ? 'member' : 'members'}`;
                        } catch {}
                      }
                      return "Group";
                    })()}
                  </div>
                ) : (
                  (() => {
                    const isOnline = activeUserEmails.includes(selectedContact.email);
                    if (isOnline) {
                      return <div className="cs text-[12px] text-jj-green font-medium">● Active</div>;
                    }
                    
                    // Try to find the last message sent by this contact in messages log to say "Last active X ago"
                    const contactMessages = messages.filter(m => m.senderId === selectedContact.dbId);
                    if (contactMessages.length > 0) {
                      const lastMsg = contactMessages[contactMessages.length - 1];
                      const date = new Date(lastMsg.sentAt);
                      
                      // Format nice string
                      const now = new Date();
                      const diffMs = now.getTime() - date.getTime();
                      const diffMins = Math.floor(diffMs / 60000);
                      
                      let timeStr = "";
                      if (diffMins < 1) timeStr = "just now";
                      else if (diffMins < 60) timeStr = `${diffMins}m ago`;
                      else {
                        const diffHours = Math.floor(diffMins / 60);
                        if (diffHours < 24) timeStr = `${diffHours}h ago`;
                        else {
                          timeStr = date.toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true
                          });
                        }
                      }
                      return <div className="cs text-[12px] text-jj-text-soft font-medium">● Last active {timeStr}</div>;
                    }
                    
                    return <div className="cs text-[12px] text-jj-text-muted font-medium">● Offline</div>;
                  })()
                )}
              </div>
            </div>

            {/* Message log content */}
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-empty !bg-transparent">
                  <div className="ce-icon">💬</div>
                  <h4>No messages yet</h4>
                  <p>Say hello to {selectedContact.name}! 👋</p>
                </div>
              ) : (
                messages.map((m) => {
                  // Direct message is senderId. Group message is sender (email)
                  const isMe = selectedContact.isGroup
                    ? m.sender === currentUser.email
                    : m.senderId === currentUser.id;

                  const senderName = selectedContact.isGroup
                    ? users.find(u => u.email === m.sender)?.name || m.sender?.split("@")[0] || "Unknown"
                    : selectedContact.name;

                  return (
                    <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} group/msg relative`}>
                      {selectedContact.isGroup && !isMe && (
                        <span className="text-[10.5px] text-jj-text-muted mb-0.5 pl-1">{senderName}</span>
                      )}
                      
                      <div className="flex items-center gap-2 max-w-[82%]">
                        <div className={`msg-bubble relative ${
                          isMe 
                            ? "bg-jj-accent/20 border border-jj-accent/30 text-jj-text rounded-br-[4px]" 
                            : "bg-jj-surface border border-jj-border text-jj-text rounded-bl-[4px]"
                        }`}>
                          {renderMessageText(m.message)}

                          {/* Delete button (only me or admin can delete, interns cannot delete) */}
                          {currentUser.role !== "intern" && (isMe || currentUser.role === "admin") && (
                            <button
                              onClick={() => handleDeleteMsg(m.id)}
                              title="Delete message"
                              className="opacity-0 group-hover/msg:opacity-100 absolute -top-2 -right-2 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-jj-red text-[9px] text-white shadow-md transition-all hover:scale-110"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="msg-time">
                        {new Date(m.sentAt).toLocaleTimeString("en-IN", {
                          hour: "numeric",
                          minute: "2-digit"
                        })}
                        {isMe && <span className="text-jj-blue ml-1 font-semibold">✓✓</span>}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing indicator simulation */}
              {typingContact && (
                <div className="flex items-center gap-1 pl-2 text-[12px] italic text-jj-text-soft">
                  <span className="typing-dots">{typingContact} is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message controls input area */}
            <div className="chat-input-area relative">
              {/* Emoji Popup dialog */}
              {emojiPopupOpen && (
                <div
                  ref={emojiRef}
                  id="emojiPopup"
                  className="absolute bottom-[60px] left-[16px] z-50 grid grid-cols-5 gap-2 rounded-xl border border-jj-border bg-jj-surface p-[10px] text-[20px] shadow-2xl"
                  style={{ display: "grid" }}
                >
                  {["👍", "😂", "❤️", "🔥", "🎉", "🙌", "😊", "😎", "🤔", "👀"].map((emoji) => (
                    <div
                      key={emoji}
                      onClick={() => addEmoji(emoji)}
                      className="cursor-pointer text-center hover:scale-125 transition-transform duration-100"
                    >
                      {emoji}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setEmojiPopupOpen(!emojiPopupOpen)}
                className="icon-btn h-9 w-9 shrink-0 rounded-[9px] border border-jj-border bg-jj-surface2 p-1 text-jj-text-soft hover:text-jj-accent"
                title="Insert Emoji"
              >
                <Smile size={16} />
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="icon-btn h-9 w-9 shrink-0 rounded-[9px] border border-jj-border bg-jj-surface2 p-1 text-jj-text-soft hover:text-jj-accent"
                title="Attach file"
              >
                <Paperclip size={16} />
              </button>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,.pdf"
                className="hidden"
              />

              <input
                type="text"
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message or paste a link..."
                className="chat-input"
              />

              <button
                onClick={() => handleSend()}
                disabled={!msgInput.trim() || loading}
                className="send-btn shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="chat-empty">
            <div className="ce-icon">💬</div>
            <h4>No conversation open</h4>
            <p>Pick a contact from the left to start messaging</p>
          </div>
        )}
      </div>

      {/* Floating pin context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-lg border border-jj-border bg-jj-surface p-3 text-[13px] text-jj-text shadow-xl flex flex-col gap-1"
          style={{ top: contextMenu.y + 2, left: contextMenu.x + 2 }}
        >
          <button
            onClick={() => togglePin(contextMenu.contactId)}
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 hover:bg-jj-surface2 text-left transition-colors"
          >
            <Pin size={13} />
            {pinnedContactIds.includes(contextMenu.contactId) ? "Unpin Chat" : "Pin Chat"}
          </button>

          <button
            onClick={() => {
              const contact = contacts.find((c) => c.id === contextMenu.contactId);
              if (contact) {
                setRenameContact(contact);
                setNewNameInput(contact.name);
              }
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 hover:bg-jj-surface2 text-left transition-colors"
          >
            <Edit2 size={13} />
            Rename
          </button>

          <button
            onClick={() => {
              const contact = contacts.find((c) => c.id === contextMenu.contactId);
              if (contact) {
                setDeleteContactTarget(contact);
              }
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 hover:bg-red-500/10 text-red-500 text-left transition-colors"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )}

      {/* Rename Dialog Modal */}
      {renameContact && (
        <div className="modal-shell">
          <div className="modal">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-jj-text flex items-center gap-2">
                <Edit2 size={18} className="text-jj-accent" />
                Rename {renameContact.isGroup ? "Group" : "Contact"}
              </h3>
              <button
                type="button"
                onClick={() => setRenameContact(null)}
                className="modal-close"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-jj-text-muted mb-4">
              Enter a new name for this conversation. This will update the display name.
            </p>
            <input
              type="text"
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              className="w-full bg-jj-surface2 border border-jj-border rounded-lg px-3 py-2 text-jj-text focus:outline-none focus:border-jj-accent mb-4 text-sm"
              placeholder="Enter new name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRename(renameContact, newNameInput);
                  setRenameContact(null);
                } else if (e.key === "Escape") {
                  setRenameContact(null);
                }
              }}
            />
            <div className="modal-footer">
              <button
                onClick={() => setRenameContact(null)}
                className="px-6 py-2.5 rounded-md border border-jj-border hover:bg-jj-surface2 transition-colors text-jj-text text-[13px] font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleRename(renameContact, newNameInput);
                  setRenameContact(null);
                }}
                className="px-6 py-2.5 rounded-md bg-jj-accent text-white hover:opacity-90 transition-opacity text-[13px] font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteContactTarget && (
        <div className="modal-shell">
          <div className="modal">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-red-500 flex items-center gap-2">
                <Trash2 size={18} />
                Delete {deleteContactTarget.isGroup ? "Group" : "Chat History"}
              </h3>
              <button
                type="button"
                onClick={() => setDeleteContactTarget(null)}
                className="modal-close"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-jj-text mb-4 leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-jj-accent">{deleteContactTarget.name}</span>?{" "}
              This will permanently delete {deleteContactTarget.isGroup ? "the group and all of its messages." : "your chat history with this user."}
            </p>
            <div className="modal-footer">
              <button
                onClick={() => setDeleteContactTarget(null)}
                className="px-6 py-2.5 rounded-md border border-jj-border hover:bg-jj-surface2 transition-colors text-jj-text text-[13px] font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDelete(deleteContactTarget);
                  setDeleteContactTarget(null);
                }}
                className="px-6 py-2.5 rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors text-[13px] font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox full image popup overlay */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center cursor-zoom-out p-4"
        >
          <img
            src={lightboxSrc}
            alt="Lightbox view"
            className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
