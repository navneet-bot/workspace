"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu, Moon, Sun } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useUIStore } from "@/hooks/useUIStore";
import { getUserNotifications, markRead } from "@/app/actions/notifications";
import Link from "next/link";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/users": "Users & Roles",
  "/dashboard/candidates": "Candidates",
  "/dashboard/tasks": "Tasks",
  "/dashboard/projects": "Projects",
  "/dashboard/attendance": "Attendance",
  "/dashboard/reports": "Reports",
  "/dashboard/worklogs": "Work Logs",
  "/dashboard/productivity": "Productivity",
  "/dashboard/chat": "Chat",
  "/dashboard/groups": "Groups",
  "/dashboard/meetings": "Meetings",
  "/dashboard/calendar": "Calendar",
  "/dashboard/notifications": "Notifications",
  "/dashboard/mytasks": "My Tasks",
  "/dashboard/settings": "Settings",
  "/dashboard/tutors": "Tutors",
};

const SUBTITLES: Record<string, string> = {
  "/dashboard": "Overview of all activities",
  "/dashboard/users": "Manage roles and permissions",
  "/dashboard/candidates": "Manage applicants",
  "/dashboard/tasks": "Assign and track tasks",
  "/dashboard/projects": "Project progress",
  "/dashboard/attendance": "Daily attendance",
  "/dashboard/reports": "Work reports",
  "/dashboard/worklogs": "Daily intern work logs",
  "/dashboard/productivity": "Performance metrics",
  "/dashboard/chat": "Team messages",
  "/dashboard/groups": "Project teams",
  "/dashboard/meetings": "Scheduled meetings",
  "/dashboard/calendar": "Events and schedule",
  "/dashboard/notifications": "Alerts and updates",
  "/dashboard/mytasks": "Your assigned tasks",
  "/dashboard/settings": "Account, email & security settings",
  "/dashboard/tutors": "Tutor recruitment, onboarding & management",
};

interface Notification {
  id: number;
  title: string;
  body: string;
  icon: string;
  targetEmail: string;
  read: boolean;
  seenBy: string;
  createdAt: string;
}

export function DashboardHeader({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  
  const {
    isMobileSidebarOpen,
    setMobileSidebarOpen,
    isNotifPopupOpen,
    setNotifPopupOpen,
    addToast,
    liveNotifs,
    addLiveNotif,
    removeLiveNotif
  } = useUIStore();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  
  const notifRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(-1);

  // Sync theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("jj_theme") || "dark";
    if (savedTheme === "light") {
      document.body.classList.add("light-mode");
      setTheme("light");
    } else {
      document.body.classList.remove("light-mode");
      setTheme("dark");
    }
  }, []);

  const toggleTheme = () => {
    if (theme === "dark") {
      document.body.classList.add("light-mode");
      localStorage.setItem("jj_theme", "light");
      setTheme("light");
    } else {
      document.body.classList.remove("light-mode");
      localStorage.setItem("jj_theme", "dark");
      setTheme("dark");
    }
  };

  // Synthesize beep sound
  const playNotifSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  };

  // Poll Notifications
  const loadNotifications = async () => {
    if (!userEmail) return;
    const res = await getUserNotifications(userEmail);
    if (res.success && res.notifications) {
      const allNotifs = res.notifications as Notification[];
      
      // Calculate unread count specifically for this user
      // A notification is unread if its read property is false AND the user has not seen it yet (not in seenBy JSON array)
      const userUnread = allNotifs.filter(n => {
        if (n.read) return false;
        try {
          const seenList = JSON.parse(n.seenBy || "[]");
          return !seenList.includes(userEmail);
        } catch {
          return true;
        }
      });
      
      const unread = userUnread.length;
      setNotifications(allNotifs);
      setUnreadCount(unread);

      // Play beep and add live notifications for new alerts
      if (lastCountRef.current >= 0 && unread > lastCountRef.current) {
        playNotifSound();
        const diff = unread - lastCountRef.current;
        // Take the newest notifications to show live banners
        userUnread.slice(0, diff).forEach(n => {
          addLiveNotif({
            title: n.title,
            body: n.body,
            icon: n.icon
          });
        });
      }
      lastCountRef.current = unread;
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [userEmail]);

  // Handle outside clicks
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifPopupOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleNotifClick = async (n: Notification) => {
    setNotifPopupOpen(false);
    await markRead(n.id, userEmail);
    loadNotifications();

    // Map notification types to route redirects
    let route = "/dashboard/notifications";
    if (n.icon === "💬") {
      route = (n.title || "").includes(" in ") ? "/dashboard/groups" : "/dashboard/chat";
    } else if (n.icon === "👥") {
      route = "/dashboard/groups";
    } else if (n.icon === "📋") {
      route = (session?.user as { role?: string } | undefined)?.role === "intern" ? "/dashboard/mytasks" : "/dashboard/tasks";
    } else if (n.icon === "📅") {
      route = "/dashboard/meetings";
    } else if (n.icon === "📄") {
      route = "/dashboard/reports";
    }
    router.push(route);
  };

  let title = TITLES[pathname] || "Dashboard";
  let subtitle = SUBTITLES[pathname] || "Welcome back 👋";

  if (pathname.startsWith("/dashboard/tutors/") && pathname !== "/dashboard/tutors") {
    title = "Tutor Profile";
    subtitle = "Review academic background, teaching mode and notes";
  }

  return (
    <>
      <header className="main-header z-10 flex shrink-0 items-center justify-between border-b border-jj-border bg-jj-bg px-6 py-3.5">
        <div className="page-title">
          <h2 className="font-syne text-[20px] font-bold leading-none text-jj-text">{title}</h2>
          <p className="mt-0.5 text-[12px] text-jj-text-muted">{subtitle}</p>
        </div>

        <div className="header-actions flex items-center gap-2">
          {/* Mobile hamburger menu */}
          <button
            onClick={() => setMobileSidebarOpen(!isMobileSidebarOpen)}
            className="icon-btn mobile-menu-btn"
            title="Menu"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          {/* Theme toggler */}
          <button
            onClick={toggleTheme}
            className="icon-btn text-jj-text-soft hover:text-jj-accent"
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Notifications button */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifPopupOpen(!isNotifPopupOpen)}
              className={`icon-btn text-jj-text-soft hover:text-jj-accent ${
                unreadCount > 0 ? "notif-bell-active" : ""
              }`}
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <div className={`notif-dot ${unreadCount > 0 ? "visible" : ""}`} />
            </button>

            {/* Notification popup panel */}
            <div
              id="notifPopup"
              className={`${isNotifPopupOpen ? "open" : ""}`}
            >
              <div className="notif-popup-header">
                <span className="font-semibold text-jj-text text-[13.5px]">🔔 Notifications</span>
                <button
                  onClick={() => setNotifPopupOpen(false)}
                  className="text-jj-text-muted hover:text-jj-text text-[18px] cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="notif-popup-list max-h-[340px] overflow-y-auto">
                {notifications.slice(0, 10).length === 0 ? (
                  <div className="p-5 text-center text-jj-text-muted text-[12px]">
                    No notifications yet
                  </div>
                ) : (
                  notifications.slice(0, 10).map((n) => {
                    // Check if seen by current user
                    let isRead = n.read;
                    if (!isRead) {
                      try {
                        const seenList = JSON.parse(n.seenBy || "[]");
                        isRead = seenList.includes(userEmail);
                      } catch {}
                    }
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`notif-popup-item ${isRead ? "" : "unread"}`}
                      >
                        <div className="flex-shrink-0 text-[15px] w-7 h-7 rounded-lg bg-jj-accent-dim flex items-center justify-center mt-0.5">
                          {n.icon || "🔔"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="notif-popup-title">
                            {n.title}
                          </div>
                          <div className="notif-popup-body">
                            {n.body}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="notif-popup-footer">
                <Link
                  href="/dashboard/notifications"
                  onClick={() => setNotifPopupOpen(false)}
                  className="text-jj-accent text-[12.5px] hover:underline"
                >
                  View all notifications →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Live notification banners list */}
      <div id="liveNotifArea" className="fixed top-[72px] right-[20px] z-50 pointer-events-none w-[320px] flex flex-col gap-2">
        {liveNotifs.map((n) => (
          <div
            key={n.id}
            onClick={() => {
              removeLiveNotif(n.id);
              router.push("/dashboard/notifications");
            }}
            className="live-notif pointer-events-auto"
          >
            <div className="live-notif-icon">{n.icon || "🔔"}</div>
            <div className="live-notif-content">
              <div className="live-notif-title">{n.title}</div>
              {n.body && <div className="live-notif-body">{n.body}</div>}
              <div className="live-notif-hint">Tap to open Notifications →</div>
            </div>
            <button
              className="live-notif-close"
              onClick={(e) => {
                e.stopPropagation();
                removeLiveNotif(n.id);
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
