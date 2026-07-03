"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/app/hooks/useAuth";
import { UserPlus, ChevronDown, ChevronUp, Trash2, LayoutTemplate } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { HistoryIcon } from "@/app/icon/HistoryIcon";
import { CreateIcon } from "@/app/icon/CreateIcon";
import { useTranslations } from "next-intl";
import { SettingIcon } from "../Drawing/icons/SettingIcon";
import { HeartIcon } from "@/app/icon/CollectIcon";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { showToast } from "../CustomToast";
import { createPortal } from "react-dom";

type Theme = "light" | "dark";

interface DesktopSidebarProps {
  isCollapsed: boolean;
  toggleSidebar: (e: React.MouseEvent<HTMLButtonElement>) => void;
  setIsDialogOpen: (isOpen: boolean) => void;
  toggleTheme: () => void;
  theme: Theme;
  openPaymentModel: boolean;
  setIsSettingOpen: (open: boolean) => void;
}

interface NavItemProps {
  href?: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  children?: React.ReactNode;
  isCollapsed?: boolean;
  isHistoryExpanded?: boolean;
  cancelDropdown?: boolean;
  disabled?: boolean;
  target?: string;
  isNew?: boolean;
  isActiveOverride?: boolean;
}

interface ConversationListItem {
  id: string;
  title?: string;
  summary?: string;
  updatedAt?: string;
}

/* ────────────────────────────────────────────
   Design tokens — single source of truth
   Cleaner blue-silver studio UI
   ──────────────────────────────────────────── */
const getTokens = (theme: Theme) => ({
  bg: theme === "dark"
    ? "rgba(18, 24, 43, 0.58)"
    : "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,252,255,0.9) 100%)",
  bgHover: theme === "dark" ? "rgba(255,255,255,0.075)" : "rgba(244, 248, 255, 0.98)",
  bgActive: theme === "dark" ? "rgba(143,167,255,0.18)" : "rgba(143,167,255,0.18)",
  bgFloat: theme === "dark" ? "rgba(20, 28, 48, 0.78)" : "rgba(255,255,255,0.96)",
  text1: theme === "dark" ? "#f4f6ff" : "#273655",
  text2: theme === "dark" ? "#b7c5e1" : "#607394",
  text3: theme === "dark" ? "#8e9dbb" : "#89a0b5",
  accent: "#7d90ff",
  accentDim: "#6b7cff",
  active: "#7d90ff",
  activeBg: theme === "dark" ? "rgba(143,167,255,0.18)" : "rgba(143,167,255,0.18)",
  border: theme === "dark" ? "rgba(180,191,255,0.14)" : "rgba(194, 206, 255, 0.72)",
  danger: "#e87474",
  radius: "12px",
  radiusSm: "10px",
  fast: "160ms ease-out",
  normal: "220ms ease-out",
});

const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  isCollapsed,
  toggleSidebar,
  setIsDialogOpen,
  theme,
  setIsSettingOpen,
}) => {
  const tk = getTokens(theme);
  const { user, logout } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConversationListItem | null>(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("navigation");

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lng = pathname?.split("/")[1] || "en";
  const selectedConversationId = searchParams.get("conversationId");
  const hasLocalePrefix = (href: string) => /^\/(?:en|zh-TW|ja)(?:\/|$)/.test(href);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const newChatLabel =
    lng === "zh-TW" ? "新的對話" : lng === "ja" ? "新しい会話" : "New chat";
  const allChatsLabel =
    lng === "zh-TW" ? "全部對話" : lng === "ja" ? "すべての会話" : "All chats";
  const recentChatsLabel =
    lng === "zh-TW" ? "最近" : lng === "ja" ? "最近" : "Recent";
  const templatesLabel =
    lng === "zh-TW" ? "模板" : lng === "ja" ? "テンプレート" : "Templates";
  const deleteDialogTitle =
    lng === "zh-TW" ? "刪除對話？" : lng === "ja" ? "会話を削除しますか？" : "Delete conversation?";
  const deleteDialogBody =
    lng === "zh-TW"
      ? "這個動作無法復原，對話紀錄會從列表移除。"
      : lng === "ja"
        ? "この操作は元に戻せません。会話履歴は一覧から削除されます。"
        : "This action cannot be undone. The conversation will be removed from the list.";
  const cancelLabel = lng === "zh-TW" ? "取消" : lng === "ja" ? "キャンセル" : "Cancel";
  const deleteLabel = lng === "zh-TW" ? "刪除" : lng === "ja" ? "削除" : "Delete";
  const deletingLabel = lng === "zh-TW" ? "刪除中..." : lng === "ja" ? "削除中..." : "Deleting...";
  const closeDeleteDialogLabel =
    lng === "zh-TW"
      ? "關閉刪除對話視窗"
      : lng === "ja"
        ? "削除確認を閉じる"
        : "Close delete confirmation";
  const deleteSuccessMessage =
    lng === "zh-TW" ? "已刪除對話" : lng === "ja" ? "会話を削除しました" : "Conversation deleted";
  const deleteFailureMessage =
    lng === "zh-TW"
      ? "刪除對話失敗，請稍後再試"
      : lng === "ja"
        ? "会話の削除に失敗しました。しばらくしてからもう一度お試しください"
        : "Failed to delete conversation. Please try again later.";
  const isNewChatActive =
    pathname === `/${lng}/drawing` && !selectedConversationId;

  const startNewConversation = useCallback(() => {
    window.dispatchEvent(new CustomEvent("drawing:new-conversation"));
    router.push(`/${lng}/drawing`);
  }, [lng, router]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) return;

      const data = await res.json();
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.result)
          ? data.result
          : Array.isArray(data?.docs)
            ? data.docs
            : Array.isArray(data?.result?.docs)
              ? data.result.docs
              : [];

      setConversations(items.slice(0, 12));
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }

    fetchConversations();
  }, [fetchConversations, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const handleConversationCreated = () => {
      fetchConversations();
    };
    window.addEventListener("conversation-created", handleConversationCreated);
    return () => window.removeEventListener("conversation-created", handleConversationCreated);
  }, [fetchConversations, user]);

  const requestDeleteConversation = useCallback((conversation: ConversationListItem) => {
    setDeleteTarget(conversation);
  }, []);

  const handleDeleteConversation = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeletingConversation(true);
    try {
      const res = await fetch(`/api/chat/conversations/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        let detail = "";
        try {
          const data = await res.json();
          detail = data?.message || data?.error || "";
        } catch {
          detail = await res.text().catch(() => "");
        }
        throw new Error(detail || "Failed to delete conversation");
      }

      setConversations((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      showToast(deleteSuccessMessage);

      if (selectedConversationId === deleteTarget.id) {
        startNewConversation();
      }
      setDeleteTarget(null);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      showToast(deleteFailureMessage, true);
    } finally {
      setIsDeletingConversation(false);
    }
  }, [deleteFailureMessage, deleteSuccessMessage, deleteTarget, selectedConversationId, startNewConversation]);

  /* ────────────────────────────────
     NavItem — refined micro-component
     ──────────────────────────────── */
  const NavItem = ({
    href,
    icon,
    label,
    onClick,
    children,
    isCollapsed,
    isHistoryExpanded,
    cancelDropdown,
    disabled = false,
    target,
    isNew = false,
    isActiveOverride,
  }: NavItemProps) => {
    const isExternalLink =
      href && (href.startsWith("http") || target === "_blank");
    const resolvedHref =
      href && !isExternalLink && !hasLocalePrefix(href)
        ? `/${lng}${href === "/" ? "" : href}`
        : href;

    const isActive =
      typeof isActiveOverride === "boolean"
        ? isActiveOverride
        : !!href &&
          !disabled &&
          !href.startsWith("http") &&
          (pathname === resolvedHref || pathname === href || pathname === `/${lng}${href}`);

    /* ── Shared inline styles instead of Tailwind soup ── */
    const itemStyle: React.CSSProperties = {
      display: "flex",
      alignItems: "center",
      gap: isCollapsed ? 0 : 12,
      padding: isCollapsed ? "8px 0" : "8px 12px",
      justifyContent: isCollapsed ? "center" : "flex-start",
      borderRadius: tk.radiusSm,
      fontSize: 13,
      fontWeight: 500,
      letterSpacing: "-0.01em",
      color: disabled ? tk.text3 : isActive ? tk.text1 : tk.text2,
      background: isActive ? tk.activeBg : "transparent",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: `background ${tk.fast}, color ${tk.fast}`,
      position: "relative",
      textDecoration: "none",
      width: "100%",
    };

    /* Subtle left-edge indicator for active state */
    const activeBar: React.CSSProperties = isActive
      ? {
        position: "absolute",
        left: 2,
        top: "22%",
        bottom: "22%",
        width: 2,
        borderRadius: 1,
        background: tk.active,
      }
      : {};

    const iconStyle: React.CSSProperties = {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 18,
      height: 18,
      flexShrink: 0,
      color: isActive ? tk.active : disabled ? tk.text3 : tk.text2,
      transition: `color ${tk.fast}`,
    };

    const handleHover = (e: React.MouseEvent, enter: boolean) => {
      if (disabled || isActive) return;
      const el = e.currentTarget as HTMLElement;
      el.style.background = enter ? tk.bgHover : "transparent";
      el.style.color = enter ? tk.text1 : tk.text2;
      // Tint icon on hover
      const iconEl = el.querySelector("[data-icon]") as HTMLElement | null;
      if (iconEl) {
        iconEl.style.color = enter ? tk.active : tk.text2;
      }
    };

    const content = (
      <>
        {isActive && <span style={activeBar} />}
        <span data-icon style={iconStyle}>
          {icon}
        </span>
        {!isCollapsed && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              overflow: "hidden",
              whiteSpace: "nowrap",
              transition: `opacity ${tk.normal}`,
            }}
          >
            {label}
            {isNew && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  color: tk.accent,
                  background: "rgba(212,168,83,0.12)",
                  padding: "2px 7px",
                  borderRadius: 4,
                  lineHeight: "16px",
                }}
              >
                New
              </span>
            )}
          </span>
        )}
        {disabled && !isCollapsed && (
          <span
            style={{
              fontSize: 10,
              color: tk.text3,
              marginLeft: "auto",
              whiteSpace: "nowrap",
            }}
          >
            {t("coming_soon")}
          </span>
        )}
        {!cancelDropdown && !isCollapsed && onClick && (
          <span style={{ marginLeft: "auto", color: tk.text3, display: "flex" }}>
            {isHistoryExpanded ? (
              <ChevronUp size={15} strokeWidth={1.5} />
            ) : (
              <ChevronDown size={15} strokeWidth={1.5} />
            )}
          </span>
        )}
      </>
    );

    const eventHandlers = {
      onMouseEnter: (e: React.MouseEvent) => handleHover(e, true),
      onMouseLeave: (e: React.MouseEvent) => handleHover(e, false),
    };

    if (href) {
      if (isExternalLink) {
        return (
          <div>
            <a
              href={disabled ? undefined : resolvedHref}
              target={target || "_self"}
              rel={target === "_blank" ? "noopener noreferrer" : undefined}
              style={itemStyle}
              aria-disabled={disabled}
              onClick={(e) => disabled && e.preventDefault()}
              {...eventHandlers}
            >
              {content}
            </a>
            {children}
          </div>
        );
      }
      return (
        <div>
          <Link
            href={disabled ? "#" : resolvedHref || "#"}
            style={itemStyle}
            target={target || "_self"}
            aria-disabled={disabled}
            onClick={(e) => disabled && e.preventDefault()}
            {...eventHandlers}
          >
            {content}
          </Link>
          {children}
        </div>
      );
    }

    return (
      <div>
        <button
          onClick={() => !disabled && onClick?.()}
          style={itemStyle}
          disabled={disabled}
          {...eventHandlers}
        >
          {content}
        </button>
        {children}
      </div>
    );
  };

  /* ────────────────────────────────
     Auth helpers
     ──────────────────────────────── */
  const handleLoginClick = () => {
    localStorage.setItem("termsAgreed", "true");
    setIsDialogOpen(true);
  };

  if (!isClient) return null;

  /* ════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════ */
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        height: "100%",
        width: isCollapsed ? 60 : 240,
        background: tk.bg,
        borderRight: `1px solid ${tk.border}`,
        zIndex: 12,
        flexDirection: "column",
        transition: `width ${tk.normal}`,
        fontFamily:
          "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
        overflow: "visible",
      }}
      className="hidden md:flex"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: tk.bg,
          borderRight: `1px solid ${tk.border}`,
          overflow: "visible",
          backdropFilter: theme === "dark" ? "blur(26px)" : "blur(14px)",
          WebkitBackdropFilter: theme === "dark" ? "blur(26px)" : "blur(14px)",
          boxShadow: theme === "dark" ? "0 20px 50px rgba(4,8,20,0.26)" : "0 16px 40px rgba(145,160,218,0.14)",
          position: "relative",
        }}
      >
        {theme !== "dark" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(circle at 18% 14%, rgba(110, 224, 211, 0.16), transparent 24%), radial-gradient(circle at 84% 18%, rgba(150, 167, 255, 0.14), transparent 28%), radial-gradient(circle at 76% 82%, rgba(170, 138, 255, 0.12), transparent 26%)",
              opacity: 0.9,
            }}
          />
        )}
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            flexDirection: isCollapsed ? "column" : "row",
            alignItems: "center",
            justifyContent: isCollapsed ? "flex-start" : "space-between",
            gap: isCollapsed ? 4 : 0,
            minHeight: isCollapsed ? 92 : 76,
            padding: isCollapsed ? "14px 8px 8px" : "16px 14px",
            transition: `padding ${tk.normal}`,
            position: "relative",
            zIndex: 1,
          }}
        >
          {isCollapsed ? (
            <Link
              href={`/${lng}`}
              style={{
                display: "inline-flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                flexShrink: 0,
              }}
            >
              <Image
                src="/images/logo-small.svg"
                alt="超星AI平台"
                width={27}
                height={30}
                className="block object-contain"
                style={{ width: "auto", height: 30 }}
                priority
              />
            </Link>
          ) : (
            <Link
              href={`/${lng}`}
              style={{
                display: "inline-flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                color: tk.text1,
                textDecoration: "none",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  flexShrink: 0,
                }}
              >
                <Image
                  src="/images/logo-small.svg"
                  alt="超星AI平台"
                  width={25}
                  height={28}
                  className="block object-contain"
                  style={{ width: "auto", height: 28 }}
                  priority
                />
              </span>
              <span
                style={{
                  fontSize: 19,
                  fontWeight: 700,
                  letterSpacing: 0,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                超星AI平台
              </span>
            </Link>
          )}

          <button
            onClick={toggleSidebar}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: isCollapsed ? 24 : 30,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: tk.text3,
              cursor: "pointer",
              transition: `all ${tk.fast}`,
              flexShrink: 0,
              position: "relative",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = tk.bgHover;
              (e.currentTarget as HTMLElement).style.color = tk.text2;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = tk.text3;
            }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              {isCollapsed ? (
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              )}
            </svg>
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: isCollapsed ? "10px 6px" : "10px 8px",
          overflowY: "auto",
          overflowX: "hidden",
          transition: `padding ${tk.normal}`,
          position: "relative",
          zIndex: 1,
        }}
        className="[scrollbar-width:thin] [scrollbar-color:rgba(83,199,255,0.28)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(83,199,255,0.18)] hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(83,199,255,0.32)]"
        >
        <>
          <NavItem
            href="/templates"
            icon={<LayoutTemplate size={16} strokeWidth={1.8} />}
            label={templatesLabel}
            isCollapsed={isCollapsed}
          />
        {user ? (
          <>
            <NavItem
              onClick={startNewConversation}
              icon={
                <CreateIcon
                  className="w-full h-full"
                  wrapperClassName="w-[16px] h-[16px]"
                />
              }
              label={newChatLabel}
              isCollapsed={isCollapsed}
              isActiveOverride={isNewChatActive}
            />
            <NavItem
              href="/recents"
              icon={
                <HistoryIcon
                  className="w-full h-full"
                  wrapperClassName="w-[15px] h-[15px]"
                />
              }
              label={allChatsLabel}
              isCollapsed={isCollapsed}
            />
            {!isCollapsed && conversations.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  margin: "10px 0 6px",
                }}
              >
                <div
                  style={{
                    padding: "0 12px 6px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: tk.text3,
                  }}
                >
                  {recentChatsLabel}
                </div>
                {conversations.map((conversation) => {
                  const isActiveConversation =
                    pathname === `/${lng}/drawing` &&
                    selectedConversationId === conversation.id;
                  const itemLabel =
                    conversation.title ||
                    conversation.summary ||
                    "New conversation";

                  return (
                    <div
                      key={conversation.id}
                      className="group"
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        borderRadius: 10,
                        background: isActiveConversation ? tk.activeBg : "transparent",
                        transition: `background ${tk.fast}, color ${tk.fast}`,
                      }}
                    >
                      <Link
                        href={`/${lng}/drawing?conversationId=${conversation.id}`}
                        style={{
                          display: "block",
                          minWidth: 0,
                          flex: 1,
                          borderRadius: 10,
                          padding: "8px 40px 8px 10px",
                          fontSize: 13,
                          fontWeight: 500,
                          lineHeight: 1.45,
                          textDecoration: "none",
                          color: isActiveConversation ? tk.text1 : tk.text3,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={itemLabel}
                      >
                        {itemLabel}
                      </Link>
                      <div
                        className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                      >
                        <button
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            requestDeleteConversation(conversation);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 26,
                            height: 26,
                            border: "none",
                            borderRadius: 8,
                            background: "transparent",
                            color: tk.text3,
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                          aria-label={deleteLabel}
                          title={deleteLabel}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <NavItem
              href="/library"
              icon={
                <HistoryIcon
                  className="w-full h-full"
                  wrapperClassName="w-[15px] h-[15px]"
                />
              }
              label={t("my_library")}
              isCollapsed={isCollapsed}
            />
            <NavItem
              href="/collecting"
              icon={
                <HeartIcon
                  className="w-full h-full"
                  wrapperClassName="w-[16px] h-[16px]"
                />
              }
              label={t("collecting")}
              isCollapsed={isCollapsed}
            />
          </>
        ) : (
          <>
            <NavItem
              icon={<UserPlus size={16} strokeWidth={1.5} />}
              label={t("sign_in")}
              onClick={handleLoginClick}
              isCollapsed={isCollapsed}
              cancelDropdown
            />
          </>
        )}
        </>
        </nav>

        {/* ── Bottom area: CTA + User ── */}
        <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: isCollapsed ? "8px 6px" : "8px 8px 10px",
          transition: `padding ${tk.normal}`,
        }}
        >

        {/* ── User row ── */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: isCollapsed ? 0 : 10,
              justifyContent: isCollapsed ? "center" : "space-between",
              padding: isCollapsed ? "6px 0" : "6px 4px",
            }}
          >
            {/* Avatar + Name */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                borderRadius: tk.radiusSm,
                padding: isCollapsed ? "4px" : "4px 8px",
                transition: `background ${tk.fast}`,
                overflow: "hidden",
                minWidth: 0,
                justifyContent: isCollapsed ? "center" : "flex-start",
              }}
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = tk.bgHover;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: `linear-gradient(135deg, ${tk.active}, #5a6f8a)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                  letterSpacing: 0,
                }}
              >
                {user?.email?.[0]?.toUpperCase() || "G"}
              </div>
              {!isCollapsed && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: tk.text1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 110,
                  }}
                >
                  {user?.email?.split("@")[0] || t("guest")}
                </span>
              )}
            </div>

            {/* Settings gear — only when expanded */}
            {!isCollapsed && (
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  border: "none",
                  background: "transparent",
                  color: tk.text3,
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: `all ${tk.fast}`,
                }}
                title={t("settings_title")}
                onClick={() => {
                  setIsSettingOpen(true);
                  setIsUserMenuOpen(false);
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = tk.bgHover;
                  (e.currentTarget as HTMLElement).style.color = tk.text2;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = tk.text3;
                }}
              >
                <SettingIcon
                  className="w-full h-full"
                  wrapperClassName="w-[17px] h-[17px]"
                />
              </button>
            )}
          </div>

          {/* ── Flyout user menu ── */}
          {isUserMenuOpen && user && (
            <div
              ref={userMenuRef}
              style={{
                position: "absolute",
                left: isCollapsed ? 0 : 4,
                bottom: "calc(100% + 8px)",
                width: isCollapsed ? 236 : 220,
                borderRadius: 18,
                background: tk.bgFloat,
                border: `1px solid ${tk.border}`,
                boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
                zIndex: 50,
                overflow: "hidden",
              }}
            >
              {/* User info */}
              <div
                style={{
                  padding: "14px 16px 10px",
                  borderBottom: `1px solid ${tk.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: tk.text1,
                    marginBottom: 2,
                  }}
                >
                  {user?.email?.split("@")[0] || t("guest")}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: tk.text3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user?.email || ""}
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding: "4px 0" }}>
                {isCollapsed && (
                  <MenuAction
                    label={t("settings")}
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsSettingOpen(true);
                    }}
                  />
                )}
                <MenuAction
                  label={t("logout")}
                  danger
                  onClick={async () => {
                    try {
                      await logout();
                      setIsUserMenuOpen(false);
                    } catch (error) {
                      console.error("Logout failed:", error);
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {deleteTarget && createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-conversation-title"
          >
            <button
              aria-label={closeDeleteDialogLabel}
              className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-sm"
              onClick={() => {
                if (!isDeletingConversation) setDeleteTarget(null);
              }}
            />
            <div
              className="relative w-full max-w-[360px] rounded-2xl border p-5 shadow-2xl"
              style={{
                background: tk.bgFloat,
                borderColor: tk.border,
                color: tk.text1,
              }}
            >
              <div
                id="delete-conversation-title"
                className="text-base font-semibold"
              >
                {deleteDialogTitle}
              </div>
              <p className="mt-2 text-sm leading-6" style={{ color: tk.text2 }}>
                {deleteDialogBody}
              </p>
              <div
                className="mt-3 truncate rounded-lg px-3 py-2 text-sm"
                style={{
                  background: theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(88,104,156,0.08)",
                  color: tk.text2,
                }}
                title={deleteTarget.title || deleteTarget.summary || newChatLabel}
              >
                {deleteTarget.title || deleteTarget.summary || newChatLabel}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeletingConversation}
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50"
                  style={{
                    color: tk.text2,
                    background: theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(88,104,156,0.08)",
                  }}
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  disabled={isDeletingConversation}
                  onClick={handleDeleteConversation}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-70"
                  style={{ background: tk.danger }}
                >
                  {isDeletingConversation ? deletingLabel : deleteLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
        </div>

        {/* ── Dialogs ── */}
      </div>
    </div>
  );
};

/* ────────────────────────────────
   MenuAction — flyout menu item
   ──────────────────────────────── */
function MenuAction({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        padding: "9px 16px",
        fontSize: 13,
        fontWeight: 500,
        color: danger ? "#e87474" : "inherit",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        transition: "background 160ms ease-out",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {label}
    </button>
  );
}

export default DesktopSidebar;
