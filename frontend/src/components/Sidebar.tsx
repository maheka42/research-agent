"use client";

import { useState } from "react";

import {
  Chat,
  createChat,
  selectChat,
  deleteChat,
  renameChat,
  togglePinned,
  toggleArchived,
} from "@/lib/chat-store";
import {
  IconPlus,
  IconChat,
  IconPin,
  IconDots,
  IconPencil,
  IconArchive,
  IconTrash,
  IconChevron,
} from "@/components/icons";

/** A single row in the per-chat options dropdown. */
function MenuItem({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors cursor-pointer ${
        danger ? "text-red-400 hover:bg-red-500/10" : "text-foreground hover:bg-accent/10"
      }`}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      {label}
    </button>
  );
}

/**
 * Chat-history sidebar: a "New chat" button, pinned/recent/archived groups, and
 * a per-chat options menu (rename, pin, archive, delete). On mobile it slides in
 * over a backdrop; on desktop it's a fixed column.
 */
export function Sidebar({
  chats,
  activeChatId,
  open,
  onClose,
}: {
  chats: Chat[];
  activeChatId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const byRecent = (a: Chat, b: Chat) => b.updatedAt - a.updatedAt;
  const visible = chats.filter((c) => !c.archived);
  const pinned = visible.filter((c) => c.pinned).sort(byRecent);
  const recents = visible.filter((c) => !c.pinned).sort(byRecent);
  const archived = chats.filter((c) => c.archived).sort(byRecent);

  // Anchor the options menu to the clicked button, kept on-screen. It's rendered
  // with `position: fixed` so it isn't clipped by the sidebar's own scrolling.
  const openMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (menu?.id === id) {
      setMenu(null);
      return;
    }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const width = 176;
    const height = 210;
    const left = Math.min(r.right - 8, window.innerWidth - width - 8);
    const top = Math.min(r.bottom + 4, window.innerHeight - height - 8);
    setMenu({ id, top, left });
  };

  const startRename = (chat: Chat) => {
    setMenu(null);
    setRenameValue(chat.title);
    setRenamingId(chat.id);
  };

  const commitRename = () => {
    if (renamingId) renameChat(renamingId, renameValue);
    setRenamingId(null);
  };

  const renderChat = (chat: Chat) => {
    const isActive = chat.id === activeChatId;
    const running = chat.turns.some((t) => t.status === "running");
    const isRenaming = renamingId === chat.id;
    const menuOpen = menu?.id === chat.id;

    return (
      <div
        key={chat.id}
        onClick={() => {
          if (isRenaming) return;
          selectChat(chat.id);
          onClose();
        }}
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
          isActive ? "bg-accent/15 text-foreground" : "text-muted hover:bg-card hover:text-foreground"
        }`}
      >
        {running ? (
          <span className="w-3.5 h-3.5 shrink-0 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
        ) : chat.pinned ? (
          <IconPin className="shrink-0 opacity-70" />
        ) : (
          <IconChat className="shrink-0 opacity-70" />
        )}

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              } else if (e.key === "Escape") {
                setRenamingId(null);
              }
            }}
            onBlur={commitRename}
            className="flex-1 min-w-0 bg-background border border-accent/50 rounded px-1.5 py-0.5 text-sm text-foreground focus:outline-none"
          />
        ) : (
          <span className="flex-1 truncate text-sm">{chat.title || "New chat"}</span>
        )}

        {!isRenaming && (
          <button
            onClick={(e) => openMenu(e, chat.id)}
            aria-label="Chat options"
            className={`shrink-0 p-0.5 rounded hover:bg-background/70 text-muted hover:text-foreground transition-opacity ${
              menuOpen || isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
            }`}
          >
            <IconDots />
          </button>
        )}
      </div>
    );
  };

  const menuChat = menu ? chats.find((c) => c.id === menu.id) ?? null : null;

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-card-border bg-card/60 backdrop-blur-sm flex flex-col transform transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="p-3">
          <button
            onClick={() => {
              createChat();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-card-border bg-background text-sm font-medium text-foreground hover:border-accent/50 hover:text-accent-light transition-all cursor-pointer"
          >
            <IconPlus />
            New chat
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          {visible.length === 0 && archived.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted">No chats yet</p>
          )}

          {pinned.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted uppercase tracking-wide">
                Pinned
              </p>
              <div className="space-y-0.5">{pinned.map(renderChat)}</div>
            </>
          )}

          {recents.length > 0 && (
            <>
              <p className="px-3 pt-3 pb-1 text-xs font-medium text-muted uppercase tracking-wide">
                Recents
              </p>
              <div className="space-y-0.5">{recents.map(renderChat)}</div>
            </>
          )}

          {archived.length > 0 && (
            <div className="pt-2 mt-2 border-t border-card-border">
              <button
                onClick={() => setShowArchived((s) => !s)}
                className="w-full flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted uppercase tracking-wide hover:text-foreground transition-colors cursor-pointer"
              >
                <IconChevron className={`transition-transform ${showArchived ? "rotate-90" : ""}`} />
                Archived ({archived.length})
              </button>
              {showArchived && <div className="space-y-0.5 mt-1">{archived.map(renderChat)}</div>}
            </div>
          )}
        </nav>
      </aside>

      {/* Per-chat options menu */}
      {menu && menuChat && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setMenu(null)} aria-hidden />
          <div
            className="fixed z-[60] w-44 rounded-lg border border-card-border bg-card shadow-xl py-1 text-sm animate-fade-in"
            style={{ top: menu.top, left: menu.left }}
          >
            <MenuItem icon={<IconPencil />} label="Rename" onClick={() => startRename(menuChat)} />
            <MenuItem
              icon={<IconPin />}
              label={menuChat.pinned ? "Unpin" : "Pin chat"}
              onClick={() => {
                togglePinned(menuChat.id);
                setMenu(null);
              }}
            />
            <MenuItem
              icon={<IconArchive />}
              label={menuChat.archived ? "Unarchive" : "Archive"}
              onClick={() => {
                toggleArchived(menuChat.id);
                setMenu(null);
              }}
            />
            <div className="my-1 border-t border-card-border" />
            <MenuItem
              icon={<IconTrash />}
              label="Delete"
              danger
              onClick={() => {
                deleteChat(menuChat.id);
                setMenu(null);
              }}
            />
          </div>
        </>
      )}
    </>
  );
}
