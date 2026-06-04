"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  CheckSquare,
  Settings,
  ListTodo,
  FolderKanban, 
  Users,
  CalendarCheck,
  FileText,
  MessageSquare,
  Users2,
  Video,
  Calendar,
  Bell,
  LogOut,
  GraduationCap
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useUIStore } from "@/hooks/useUIStore";

interface NavItem {
  id: string;
  name: string;
  href?: string;
  icon: any;
  subItems?: { id: string; name: string; href: string }[];
}

interface NavSection {
  section: string;
  items: NavItem[];
}

function getNavSections(role: string, permissions: string): NavSection[] {
  const permList = (permissions || "").split(",").map(p => p.trim());
  const hasPerm = (key: string) => role === "admin" || permList.includes(key);

  if (role === "admin") {
    return [
      {
        section: "Main",
        items: [{ id: "dashboard", name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }]
      },
      {
        section: "Manage",
        items: [
          { id: "users", name: "Users & Roles", href: "/dashboard/users", icon: Users },
          { id: "candidates", name: "Candidates", href: "/dashboard/candidates", icon: Users },
          { id: "tutors", name: "Tutors", href: "/dashboard/tutors", icon: GraduationCap },
          { id: "tasks", name: "Tasks", href: "/dashboard/tasks", icon: ListTodo },
          { id: "projects", name: "Projects", href: "/dashboard/projects", icon: FolderKanban },
          { id: "attendance", name: "Attendance", href: "/dashboard/attendance", icon: CalendarCheck },
          { id: "reports", name: "Reports", href: "/dashboard/reports", icon: FileText },
          { id: "worklogs", name: "Work Logs", href: "/dashboard/worklogs", icon: FileText },
          { id: "productivity", name: "Productivity", href: "/dashboard/productivity", icon: FileText }
        ]
      },
      {
        section: "Collaborate",
        items: [
          { id: "chat", name: "Chat", href: "/dashboard/chat", icon: MessageSquare },
          { id: "groups", name: "Groups", href: "/dashboard/groups", icon: Users2 },
          { id: "meetings", name: "Meetings", href: "/dashboard/meetings", icon: Video },
          { id: "calendar", name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
          { id: "notifications", name: "Notifications", href: "/dashboard/notifications", icon: Bell }
        ]
      },
      {
        section: "System",
        items: [{ id: "settings", name: "Settings", href: "/dashboard/settings", icon: Settings }]
      }
    ];
  }

  if (role === "super_admin" || role === "tutor" || permList.length > 0) {
    const manageItems = [];

    if (role === "super_admin" || role === "tutor" || hasPerm("manage_tasks")) {
      manageItems.push({ id: "tasks", name: "Tasks", href: "/dashboard/tasks", icon: ListTodo });
    }
    if (role === "super_admin" || role === "tutor" || hasPerm("manage_projects")) {
      manageItems.push({ id: "projects", name: "Projects", href: "/dashboard/projects", icon: FolderKanban });
    }
    if (role === "super_admin" || role === "tutor") {
      manageItems.push({ id: "candidates", name: "Candidates", href: "/dashboard/candidates", icon: Users });
    }
    if (role === "super_admin" || role === "tutor" || hasPerm("manage_attendance")) {
      manageItems.push({ id: "attendance", name: "Attendance", href: "/dashboard/attendance", icon: CalendarCheck });
    }
    if (role === "super_admin" || role === "tutor" || hasPerm("view_reports")) {
      manageItems.push({ id: "reports", name: "Reports", href: "/dashboard/reports", icon: FileText });
    }
    if (hasPerm("view_tutors")) {
      manageItems.push({ id: "tutors", name: "Tutors", href: "/dashboard/tutors", icon: GraduationCap });
    }
    if (hasPerm("view_worklogs")) {
      manageItems.push({ id: "worklogs", name: "Work Logs", href: "/dashboard/worklogs", icon: FileText });
    }

    const sections: NavSection[] = [
      {
        section: "Main",
        items: [
          { id: "dashboard", name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { id: "mytasks", name: "My Tasks", href: "/dashboard/mytasks", icon: CheckSquare }
        ]
      },
      {
        section: "System",
        items: [{ id: "settings", name: "Settings", href: "/dashboard/settings", icon: Settings }]
      }
    ];

    if (manageItems.length > 0) {
      sections.push({
        section: "Manage",
        items: manageItems
      });
    }

    sections.push({
      section: "Collaborate",
      items: [
        { id: "chat", name: "Chat", href: "/dashboard/chat", icon: MessageSquare },
        { id: "groups", name: "Groups", href: "/dashboard/groups", icon: Users2 },
        { id: "meetings", name: "Meetings", href: "/dashboard/meetings", icon: Video },
        { id: "calendar", name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
        { id: "notifications", name: "Notifications", href: "/dashboard/notifications", icon: Bell }
      ]
    });

    return sections;
  }

  // Intern role
  return [
    {
      section: "Main",
      items: [
        { id: "dashboard", name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { id: "mytasks", name: "My Tasks", href: "/dashboard/mytasks", icon: CheckSquare },
        { id: "attendance", name: "Attendance", href: "/dashboard/attendance", icon: CalendarCheck },
        { id: "reports", name: "Reports", href: "/dashboard/reports", icon: FileText }
      ]
    },
    {
      section: "Collaborate",
      items: [
        { id: "chat", name: "Chat", href: "/dashboard/chat", icon: MessageSquare },
        { id: "groups", name: "Groups", href: "/dashboard/groups", icon: Users2 },
        { id: "meetings", name: "Meetings", href: "/dashboard/meetings", icon: Video },
        { id: "calendar", name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
        { id: "notifications", name: "Notifications", href: "/dashboard/notifications", icon: Bell }
      ]
    },
    {
      section: "Account",
      items: [{ id: "settings", name: "Settings", href: "/dashboard/settings", icon: Settings }]
    }
  ];
}

export function Sidebar({ userRole }: { userRole?: string }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  const { isMobileSidebarOpen, setMobileSidebarOpen, setWorkLogModalOpen } = useUIStore();

  const userPermissions = (session?.user as any)?.permissions || "";
  const navSections = getNavSections(userRole || "intern", userPermissions);

  const handleSignOutClick = () => {
    // Close mobile menu
    setMobileSidebarOpen(false);
    
    if (userRole === "intern") {
      // Check if already completed worklog today
      const alreadyDone = localStorage.getItem("jj_worklog_done");
      if (alreadyDone === "1") {
        localStorage.removeItem("jj_login_time");
        localStorage.removeItem("jj_worklog_done");
        signOut({ callbackUrl: "/login" });
      } else {
        setWorkLogModalOpen(true);
      }
    } else {
      signOut({ callbackUrl: "/login" });
    }
  };

  const roleLabel = (r: string) => {
    return { admin: "admin", super_admin: "super admin", tutor: "tutor", intern: "intern" }[r] || r;
  };

  return (
    <aside className={`sidebar ${isMobileSidebarOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">JJ</div>
          <span>
            Job <em>Jockey</em>
          </span>
        </div>
      </div>

      <div className="sidebar-user">
        <div className="user-avatar" id="sidebarAvatar">
          {session?.user?.name?.substring(0, 2).toUpperCase() || "JJ"}
        </div>
        <div className="sidebar-user-info">
          <div className="uname" id="sidebarName">
            {userRole === "admin" ? "GOD" : session?.user?.name || "Intern"}
          </div>
          <div className="urole" id="sidebarRole">
            {roleLabel(userRole || "intern")}
          </div>
        </div>
      </div>

      <nav className="sidebar-nav" id="sidebarNav">
        {navSections.map((sec) => (
          <div key={sec.section}>
            <div className="nav-section-label">{sec.section}</div>
            {sec.items.map((item) => {
              if (item.subItems) {
                const isAnySubActive = item.subItems.some((sub) => pathname === sub.href);
                return (
                  <div key={item.id} style={{ display: "flex", flexDirection: "column" }}>
                    <div
                      className={`nav-item ${isAnySubActive ? "active" : ""}`}
                      style={{ cursor: "default" }}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", marginLeft: "14px", borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: "10px", gap: "2px", marginTop: "2px", marginBottom: "4px" }}>
                      {item.subItems.map((sub) => {
                        const isSubActive = pathname === sub.href;
                        return (
                          <Link
                            key={sub.id}
                            href={sub.href}
                            onClick={() => setMobileSidebarOpen(false)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontSize: "12.5px",
                              color: isSubActive ? "var(--accent)" : "var(--text-soft)",
                              background: isSubActive ? "var(--accent-dim)" : "transparent",
                              fontWeight: isSubActive ? 600 : 500,
                              textDecoration: "none"
                            }}
                          >
                            {sub.name}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href || "#"}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`nav-item ${isActive ? "active" : ""}`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className="nav-item logout" onClick={handleSignOutClick}>
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
