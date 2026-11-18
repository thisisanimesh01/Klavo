import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import axiosClient from "../api/axiosClient";
import {
  Search,
  FolderKanban,
  CheckSquare,
  FileText,
  Users,
  Home,
  Calendar,
  FileUp,
  BarChart2,
  Settings,
  BookOpen,
  Plus,
  Moon,
  Sun,
  Clock,
  ArrowRight,
  X,
  Command,
} from "lucide-react";

const RECENT_ITEMS_KEY = "klavo_recent_palette_items";

export default function CommandPalette({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState({
    projects: [],
    tasks: [],
    documents: [],
    teams: [],
  });
  const [recentItems, setRecentItems] = useState([]);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Load recent items from localStorage on mount/open
  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem(RECENT_ITEMS_KEY);
        if (stored) {
          setRecentItems(JSON.parse(stored).slice(0, 5));
        }
      } catch (err) {
        console.error("Failed to load recent items:", err);
      }
      setQuery("");
      setSelectedIndex(0);
      setSearchResults({ projects: [], tasks: [], documents: [], teams: [] });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Save selected item to recent items
  const trackRecentItem = (item) => {
    try {
      const stored = localStorage.getItem(RECENT_ITEMS_KEY);
      let list = stored ? JSON.parse(stored) : [];
      list = [item, ...list.filter((x) => x.id !== item.id || x.type !== item.type)].slice(0, 10);
      localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(list));
      setRecentItems(list.slice(0, 5));
    } catch (err) {
      console.error("Failed to save recent item:", err);
    }
  };

  // Static navigation routes
  const navigationItems = [
    { id: "nav-dash", title: "Dashboard", subtitle: "Go to overview and personal stats", icon: <Home size={16} />, path: "/" },
    { id: "nav-proj", title: "Projects", subtitle: "Manage workspace projects", icon: <FolderKanban size={16} />, path: "/projects" },
    { id: "nav-team", title: "Teams", subtitle: "View teams and members", icon: <Users size={16} />, path: "/teams" },
    { id: "nav-cal", title: "Calendar", subtitle: "Upcoming deadlines and task schedules", icon: <Calendar size={16} />, path: "/calendar" },
    { id: "nav-files", title: "Files", subtitle: "Uploaded project attachments and assets", icon: <FileUp size={16} />, path: "/files" },
    { id: "nav-anl", title: "Analytics", subtitle: "Project velocity, workload, and health", icon: <BarChart2 size={16} />, path: "/analytics" },
    { id: "nav-settings", title: "Settings", subtitle: "Personal profile, account security, and workspace preferences", icon: <Settings size={16} />, path: "/settings" },
  ];

  // Quick action items
  const actionItems = [
    {
      id: "act-theme",
      title: theme === "light" ? "Switch to Dark Theme" : "Switch to Light Theme",
      subtitle: "Toggle visual color appearance",
      icon: theme === "light" ? <Moon size={16} /> : <Sun size={16} />,
      action: () => toggleTheme(),
    },
    {
      id: "act-create-proj",
      title: "Create New Project",
      subtitle: "Configure a project workspace",
      icon: <Plus size={16} />,
      path: "/projects?action=create",
    },
    {
      id: "act-create-team",
      title: "Create New Team",
      subtitle: "Assemble members and collaborators",
      icon: <Users size={16} />,
      path: "/teams?action=create",
    },
  ];

  // Search API execution with debouncing & cancellation
  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setSearchResults({ projects: [], tasks: [], documents: [], teams: [] });
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      const res = await axiosClient.get(`/search?q=${encodeURIComponent(searchQuery)}&limit=5`, {
        signal: controller.signal,
      });
      setSearchResults(res.data);
      setSelectedIndex(0);
    } catch (err) {
      if (err.name !== "CanceledError" && err.name !== "AbortError") {
        console.error("Search failed:", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search query listener
  useEffect(() => {
    const handler = setTimeout(() => {
      performSearch(query);
    }, 200);

    return () => clearTimeout(handler);
  }, [query, performSearch]);

  // Compose active list of items to display and navigate
  const activeSections = [];

  if (!query.trim()) {
    // When no search query is typed, show Recent Items (if any), Quick Actions, and Navigation
    if (recentItems.length > 0) {
      activeSections.push({
        title: "Recent",
        items: recentItems.map((r) => ({
          ...r,
          section: "Recent",
        })),
      });
    }

    activeSections.push({
      title: "Quick Actions",
      items: actionItems.map((a) => ({ ...a, section: "Actions" })),
    });

    activeSections.push({
      title: "Navigation",
      items: navigationItems.map((n) => ({ ...n, section: "Navigation" })),
    });
  } else {
    // When search query is entered, show matching actions, navigation, projects, tasks, documents, teams
    const matchingActions = actionItems.filter(
      (a) => a.title.toLowerCase().includes(query.toLowerCase()) || a.subtitle.toLowerCase().includes(query.toLowerCase())
    );
    if (matchingActions.length > 0) {
      activeSections.push({
        title: "Actions",
        items: matchingActions.map((a) => ({ ...a, section: "Actions" })),
      });
    }

    const matchingNav = navigationItems.filter(
      (n) => n.title.toLowerCase().includes(query.toLowerCase()) || n.subtitle.toLowerCase().includes(query.toLowerCase())
    );
    if (matchingNav.length > 0) {
      activeSections.push({
        title: "Navigation",
        items: matchingNav.map((n) => ({ ...n, section: "Navigation" })),
      });
    }

    if (searchResults.projects?.length > 0) {
      activeSections.push({
        title: "Projects",
        items: searchResults.projects.map((p) => ({
          id: `proj-${p._id}`,
          title: p.title,
          subtitle: p.teamName ? `Team: ${p.teamName}` : "Project",
          icon: <FolderKanban size={16} className="text-indigo-400" />,
          path: `/kanban/${p._id}`,
          section: "Projects",
        })),
      });
    }

    if (searchResults.tasks?.length > 0) {
      activeSections.push({
        title: "Tasks",
        items: searchResults.tasks.map((t) => ({
          id: `task-${t._id}`,
          title: t.title,
          subtitle: `${t.projectName || "Project"} • ${t.status.toUpperCase()} • ${t.priority}`,
          icon: <CheckSquare size={16} className="text-emerald-400" />,
          path: `/kanban/${t.projectId}?task=${t._id}`,
          section: "Tasks",
        })),
      });
    }

    if (searchResults.documents?.length > 0) {
      activeSections.push({
        title: "Documents & Wiki",
        items: searchResults.documents.map((d) => ({
          id: `doc-${d._id}`,
          title: d.title,
          subtitle: `${d.projectName || "Project"} • ${d.isWiki ? "Wiki Page" : "Document"}`,
          icon: d.isWiki ? <BookOpen size={16} className="text-amber-400" /> : <FileText size={16} className="text-indigo-400" />,
          path: d.isWiki ? `/wiki/${d.projectId}/${d._id}` : `/documents/${d.projectId}/${d._id}`,
          section: "Documents",
        })),
      });
    }

    if (searchResults.teams?.length > 0) {
      activeSections.push({
        title: "Teams",
        items: searchResults.teams.map((tm) => ({
          id: `team-${tm._id}`,
          title: tm.name,
          subtitle: "Workspace Team",
          icon: <Users size={16} className="text-cyan-400" />,
          path: `/teams`,
          section: "Teams",
        })),
      });
    }
  }

  // Flattened array for keyboard arrow indexing
  const flatItems = activeSections.flatMap((s) => s.items);

  const handleSelectItem = (item) => {
    trackRecentItem({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      path: item.path,
      type: item.section || "General",
    });

    onClose();

    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  // Keyboard navigation listener (ArrowUp, ArrowDown, Enter, Escape)
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (flatItems.length === 0 ? 0 : (prev + 1) % flatItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (flatItems.length === 0 ? 0 : (prev - 1 + flatItems.length) % flatItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        handleSelectItem(flatItems[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  let currentItemCounter = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 md:p-16 bg-slate-950/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global Command Palette"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <Search size={20} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search projects, tasks, docs..."
            className="flex-1 bg-transparent text-sm sm:text-base text-slate-100 placeholder-slate-400 focus:outline-none"
            aria-autocomplete="list"
          />

          {loading && (
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">ESC</span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition min-w-[28px] min-h-[28px] flex items-center justify-center"
              aria-label="Close command palette"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-4">
          {flatItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
              <Search size={32} className="mx-auto mb-2 text-slate-600 stroke-[1.5]" />
              <p className="font-semibold text-slate-300">No results found for "{query}"</p>
              <p className="text-xs text-slate-500 mt-0.5">Try searching for projects, tasks, or documents.</p>
            </div>
          ) : (
            activeSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {section.title}
                </div>

                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const itemIndex = currentItemCounter++;
                    const isSelected = itemIndex === selectedIndex;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs sm:text-sm transition group min-h-[44px] ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`shrink-0 ${isSelected ? "text-white" : "text-slate-400"}`}>
                            {item.icon || <Command size={16} />}
                          </span>
                          <div className="truncate">
                            <p className="font-medium truncate">{item.title}</p>
                            {item.subtitle && (
                              <p className={`text-[11px] truncate ${isSelected ? "text-indigo-100" : "text-slate-400"}`}>
                                {item.subtitle}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {isSelected && (
                            <span className="text-[11px] font-mono opacity-80 flex items-center gap-1">
                              <span>Select</span>
                              <ArrowRight size={12} />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">↵</kbd>
              <span>to select</span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10px]">
            <span>Klavo Quick Actions</span>
          </div>
        </div>
      </div>
    </div>
  );
}
