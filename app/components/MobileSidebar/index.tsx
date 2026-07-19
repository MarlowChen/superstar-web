import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
// import { useAuth } from "@/app/context/AuthContext";
import { useAuth } from "@/app/hooks/useAuth";
import { UserPlus, X, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { HistoryIcon } from "@/app/icon/HistoryIcon";
import { CreateIcon } from "@/app/icon/CreateIcon";
import { useTranslations } from "next-intl";
import { HomeIcon } from "../Drawing/icons/HomeIcon";
import { SettingIcon } from "../Drawing/icons/SettingIcon";
import { HeartIcon } from "@/app/icon/CollectIcon";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fetchAllConversations } from "@/app/utils/fetchAllConversations";
import PaymentModelDialog from "../PaymentModelDialog";

interface ConversationListItem {
  id: string;
  title?: string;
  summary?: string;
  updatedAt?: string;
}

interface MobileSidebarProps {
  isOpen: boolean;
  toggleSidebar: (e: React.MouseEvent<HTMLButtonElement> | null) => void;
  setIsDialogOpen: (isOpen: boolean) => void;
  setIsSettingOpen: (open: boolean) => void;
  theme: "light" | "dark";
}

const MobileSidebar: React.FC<MobileSidebarProps> = ({
  isOpen,
  toggleSidebar,
  setIsDialogOpen,
  setIsSettingOpen,
  theme,
}) => {
  // const { user, logout } = useAuth();
  const { user, logout } = useAuth();
  const t = useTranslations("navigation");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  // const [showTerms, setShowTerms] = useState(false);
  // const [pendingLogin, setPendingLogin] = useState(false);
  const [openPaymentModel, setOpenPaymentModel] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lng = pathname.split("/")[1] || "en";
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
  const isNewChatActive =
    pathname === `/${lng}/drawing` && !selectedConversationId;

  const startNewConversation = useCallback(() => {
    window.dispatchEvent(new CustomEvent("drawing:new-conversation"));
    router.push(`/${lng}/drawing`);
    toggleSidebar(null);
  }, [lng, router, toggleSidebar]);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(theme);
  const isDark = resolvedTheme === "dark";

  // const { theme, toggleTheme } = useTheme();
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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const readDomTheme = () => {
      const hasDarkClass =
        document.documentElement.classList.contains("dark") ||
        document.body.classList.contains("dark");
      setResolvedTheme(hasDarkClass ? "dark" : theme);
    };

    readDomTheme();

    const observer = new MutationObserver(readDomTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [theme]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }

    const fetchConversations = async () => {
      try {
        const items = await fetchAllConversations<ConversationListItem>();
        setConversations(items);
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
      }
    };

    fetchConversations();

    const handleConversationCreated = () => {
      fetchConversations();
    };
    window.addEventListener("conversation-created", handleConversationCreated);
    return () => window.removeEventListener("conversation-created", handleConversationCreated);
  }, [user]);

  // 🔽 NavItem 組件
  const NavItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    href?: string;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    isActive?: boolean;
    disabled?: boolean;
    isNew?: boolean; 
    target?: string;
  }> = ({ icon, label, href, onClick, disabled = false, isNew = false, target }) => {
    const baseStyles =
      "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all";

    const isExternalLink =
      href && (href.startsWith("http") || target === "_blank");
    const resolvedHref =
      href && !isExternalLink && !hasLocalePrefix(href)
        ? `/${lng}${href === "/" ? "" : href}`
        : href;
    const isRouteActive =
      !!href &&
      !disabled &&
      !href.startsWith("http") &&
      (pathname === resolvedHref || pathname === href || pathname === `/${lng}${href}`);

    const commonStyles = `${baseStyles} group ${
      disabled
        ? "cursor-not-allowed opacity-45 text-[#8aa1b8] dark:text-[#6f8ba6]"
        : isRouteActive
          ? "bg-[rgba(125,144,255,0.2)] text-[#22324a] dark:bg-[rgba(143,167,255,0.22)] dark:text-white"
          : "text-[#5f7292] hover:bg-[rgba(248,250,255,0.98)] hover:text-[#22324a] dark:text-[#a6bed2] dark:hover:bg-[rgba(255,255,255,0.08)] dark:hover:text-white"
    } overflow-visible relative`;

    const iconContainerStyles = disabled
      ? "relative mr-3 flex fill-[#8aa1b8] stroke-[#8aa1b8] stroke-[2] dark:fill-[#6f8ba6] dark:stroke-[#6f8ba6]"
      : `relative mr-3 flex stroke-[2] ${
          isRouteActive
            ? "fill-[#7d90ff] stroke-[#7d90ff]"
            : "fill-[#607394] stroke-[#607394] group-hover:fill-[#7d90ff] group-hover:stroke-[#7d90ff] dark:fill-[#a6bed2] dark:stroke-[#a6bed2] dark:group-hover:fill-[#9eb0ff] dark:group-hover:stroke-[#9eb0ff]"
        }`;

    const handleExternalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (disabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
    };

    const currentPath =
      typeof window !== "undefined" ? window.location.pathname : "";
    const currentSearch =
      typeof window !== "undefined" ? window.location.search : "";
    const isCurrentPath = resolvedHref
      ? currentPath === resolvedHref && currentSearch === ""
      : false;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      document.body.classList.add("mobile-sidebar-open");
      if (onClick) {
        onClick(e);
      }
      setTimeout(() => {
        document.body.classList.remove("mobile-sidebar-open");
      }, 500);
    };

    const renderContent = () => (
      <>
        <span className={iconContainerStyles}>{icon}</span>
        <span className="flex flex-col items-start gap-1 flex-1">
          <span className={`relative flex items-center transition-all duration-300 ${!disabled && "group-hover:text-white"}`}>
            {label}
            {isNew && (
              <span className="ml-2 rounded-full bg-[#2d2640] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b7abf6]">
                New
              </span>
            )}
          </span>
          {disabled && (
            <span className="text-[11px] font-medium whitespace-nowrap text-[#8d859d]">
              {t("coming_soon")}
            </span>
          )}
        </span>
      </>
    );

    return href ? (
      isExternalLink ? (
        // 外部連結或開新視窗：使用 <a>
        <a
          href={disabled ? undefined : resolvedHref}
          target={target || (disabled ? undefined : "_blank")}
          rel={disabled ? undefined : "noopener noreferrer"}
          className={commonStyles}
          onClick={handleExternalClick}
          aria-disabled={disabled}
        >
          {renderContent()}
        </a>
      ) : (
        // 內部路由：使用 Next.js <Link>
        <Link
          href={disabled ? "#" : resolvedHref || "#"}
          className={commonStyles}
          onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
            if (disabled) {
              e.preventDefault();
              return;
            }
            if (isCurrentPath) {
              e.preventDefault();
              return;
            }
            document.body.classList.add("mobile-sidebar-open");
            if (onClick) {
              onClick(e as unknown as React.MouseEvent<HTMLButtonElement>);
            }
            setTimeout(() => {
              document.body.classList.remove("mobile-sidebar-open");
            }, 500);
          }}
          aria-disabled={disabled}
        >
          {renderContent()}
        </Link>
      )
    ) : (
      <button
        onClick={(e) => {
          if (disabled) return;
          document.body.classList.add("mobile-sidebar-open");
          handleClick(e);
          setTimeout(() => {
            document.body.classList.remove("mobile-sidebar-open");
          }, 500);
        }}
        className={`${commonStyles} w-full text-left`}
        disabled={disabled}
      >
        {renderContent()}
      </button>
    );
  };

  const handleLoginClick = () => {
    localStorage.setItem("termsAgreed", "true");
    // setShowTerms(false);
    // setPendingLogin(false);
    setIsDialogOpen(true);
  };

  // const handleAgreeTerms = () => {
  //   localStorage.setItem("termsAgreed", "true");
  //   setShowTerms(false);
  //   if (pendingLogin) {
  //     setIsDialogOpen(true);
  //     setPendingLogin(false);
  //   }
  // };

  // const FreeTrialButton = ({
  //   onClick,
  //   isCollapsed,
  // }: {
  //   onClick: () => void;
  //   isCollapsed: boolean;
  // }) => {
  //   return (
  //     <div>
  //       <button
  //         onClick={onClick}
  //         className={`
  //         ${isCollapsed ? "h-11 w-11" : "h-12"} 
  //         px-3 py-2 text-left w-full flex items-center justify-center transition-all duration-300 
  //         rounded-xl bg-[#6d5bd0] text-white font-medium hover:bg-[#5e4cc3]
  //         overflow-hidden relative
  //       `}
  //     >
  //       <div
  //         className={`
  //         ${isCollapsed ? "w-full" : "w-8"} 
  //         flex items-center justify-center relative z-10
  //       `}
  //         >
  //           <svg
  //             className={`
  //             ${isCollapsed ? "w-6 h-6" : "w-5 h-5"} 
  //             transition-all duration-300
  //           `}
  //             viewBox="0 0 24 24"
  //             fill="currentColor"
  //           >
  //             <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
  //           </svg>
  //         </div>
  //         {!isCollapsed && (
  //           <div className="flex flex-col ml-2 relative z-10 transition-all duration-300 text-sm">
  //             <span>{t("free_trial_10_images")}</span>
  //           </div>
  //         )}
  //       </button>
  //     </div>
  //   );
  // };

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-300 md:hidden ${
          isOpen ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        onClick={() => {
          if (!isOpen) {
            toggleSidebar(null as unknown as React.MouseEvent<HTMLButtonElement>);
          }
        }}
      />
      <nav
        className={`${isDark ? "dark" : ""} block md:hidden fixed bottom-0 left-0 top-0 z-40 w-72 transition-transform duration-300 ease-in-out ${
          isOpen ? "-translate-x-full pointer-events-none" : "translate-x-0"
        }`}
      >
        <div
          className={`absolute inset-0 overflow-hidden rounded-r-2xl border shadow-[0_16px_40px_rgba(145,160,218,0.14)] backdrop-blur-[14px] ${
            isDark
              ? "border-[rgba(180,191,255,0.14)] bg-[#121a2b] shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
              : "border-[rgba(194,206,255,0.72)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,252,255,0.94)_100%)]"
          }`}
        />
        {!isDark && (
          <div className="pointer-events-none absolute inset-0 rounded-r-2xl bg-[radial-gradient(circle_at_18%_14%,rgba(110,224,211,0.16),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(150,167,255,0.14),transparent_28%),radial-gradient(circle_at_76%_82%,rgba(170,138,255,0.12),transparent_26%)] opacity-90" />
        )}

        <div className={`relative z-10 flex h-full flex-col gap-2 p-3 ${isDark ? "text-[#a6bed2]" : "text-[#58718a]"}`}>
          <div className="flex items-center justify-between h-12">
            <Link
              href={`/${lng}`}
              className="inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-2xl px-1.5"
              style={{ flexDirection: "row", gap: 14 }}
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center">
                <Image
                  src="/images/logo-small.svg"
                  alt="超星AI平台"
                  width={28}
                  height={28}
                  className="block object-contain"
                  priority
                />
              </span>
              <span className="text-[15px] font-bold leading-none text-[#22324a] dark:text-white">
                超星AI平台
              </span>
            </Link>
            <button
              onClick={toggleSidebar}
              className="rounded-xl p-2 text-[#89a0b5] transition hover:bg-[#ebf4fb] hover:text-[#10243a] dark:text-[#6f8ba6] dark:hover:bg-[#132131] dark:hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="space-y-1 px-2">
              <NavItem
                icon={<LayoutTemplate size={18} strokeWidth={1.8} />}
                label={templatesLabel}
                href="/templates"
              />

              <NavItem
                icon={
                  <HomeIcon
                    className="w-full  h-full ml-[0px] "
                    wrapperClassName="w-[16px] h-[16px]"
                  />
                }
                label={t("home")}
                href={`/${lng}`}
              />

              {user && (
                <>
                  <NavItem
                    icon={
                      <CreateIcon
                        className="w-full h-full ml-[1px]"
                        wrapperClassName="w-[16px] h-[16px]"
                      />
                    }
                    label={newChatLabel}
                    isActive={isNewChatActive}
                    onClick={startNewConversation}
                  />
                  <NavItem
                    icon={
                      <HistoryIcon
                        className="w-full h-full ml-[1px]"
                        wrapperClassName="w-[15px] h-[15px]"
                      />
                    }
                    label={allChatsLabel}
                    href="/recents"
                  />
                  <NavItem
                    icon={
                      <HistoryIcon
                        className="w-full h-full ml-[1px]"
                        wrapperClassName="w-[15px] h-[15px]"
                      />
                    }
                    label={t("my_library")}
                    href="/library"
                  />
                  {conversations.length > 0 && (
                    <div className="mt-4 space-y-1">
                      <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#89a0b5] dark:text-[#6f8ba6]">
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
                            className={`rounded-xl ${
                              isActiveConversation
                                ? isDark
                                  ? "bg-[#17314a]"
                                  : "bg-[#173a56]"
                                : ""
                            }`}
                          >
                            <Link
                              href={`/${lng}/drawing?conversationId=${conversation.id}`}
                              className={`block min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                                isActiveConversation
                                  ? "text-white"
                                  : "text-[#58718a] hover:bg-[#ebf4fb] hover:text-[#10243a] dark:text-[#a6bed2] dark:hover:bg-[#132131] dark:hover:text-white"
                              }`}
                              onClick={() => {
                                document.body.classList.add("mobile-sidebar-open");
                                setTimeout(() => {
                                  document.body.classList.remove("mobile-sidebar-open");
                                }, 500);
                              }}
                              title={itemLabel}
                            >
                              <span className="block truncate">{itemLabel}</span>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <NavItem
                    href="/collecting"
                    icon={
                      <HeartIcon
                        className="w-full h-full ml-[1px]"
                        wrapperClassName="w-[16px] h-[16px]"
                      />
                    }
                    label={t("collecting")}
                  />

                </>
              )}
            </div>

            <div className="space-y-1 px-2">
              {!user && (
                <NavItem
                  icon={<UserPlus size={18} strokeWidth={1.5} />}
                  label={t("sign_in")}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLoginClick();
                  }}
                />
              )}

            </div>
          </div>

          <div className="relative">
            {/* User Profile */}
          <div className="mt-auto space-y-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSettingOpen(true);
                  setIsUserMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-2xl bg-[#eef4fa] p-3 text-left text-[#10243a] transition-colors duration-200 hover:bg-[#e4eef8] dark:bg-[#101a26] dark:text-[#eff7ff] dark:hover:bg-[#132131]"
              >
                <SettingIcon
                  className="w-full h-full ml-[0px]"
                  wrapperClassName="w-[18px] h-[18px]"
                />
                <span className="text-sm">{t("settings")}</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsUserMenuOpen(!isUserMenuOpen);
                }}
                className={`flex w-full items-center justify-between rounded-2xl bg-[#eef4fa] p-3 transition-colors duration-200 dark:bg-[#101a26] ${
                  user ? "hover:bg-[#e4eef8] dark:hover:bg-[#132131]" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#159cff] text-xs font-bold text-white dark:bg-[#53c7ff] dark:text-[#09111b]">
                    {user?.email?.[0] || "G"}
                  </div>
                  <span className="truncate text-[#10243a] dark:text-white">
                    {user?.email?.split("@")[0] || t("guest")}
                  </span>
                </div>
              </button>
            </div>

            {isUserMenuOpen && (
              <div
                ref={userMenuRef}
                className="absolute left-0 bottom-full mb-2 w-full rounded-2xl bg-white py-2 shadow-[0_18px_40px_rgba(16,36,58,0.14)] dark:bg-[#101a26] dark:shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
              >
                <div className="px-4 py-3">
                  <div className="text-sm font-medium text-[#10243a] dark:text-white">
                    {user?.email?.split("@")[0] || t("guest")}
                  </div>
                  <div className="truncate text-xs text-[#89a0b5] dark:text-[#6f8ba6]">
                    {user?.email || ""}
                  </div>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsSettingOpen(true);
                    }}
                    className="flex w-full items-center px-4 py-2 text-sm text-[#58718a] hover:bg-[#eef4fa] dark:text-[#d5e6f6] dark:hover:bg-[#132131]"
                  >
                    <span>{t("settings")}</span>
                  </button>

                  {!user && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsUserMenuOpen(false);
                        handleLoginClick();
                      }}
                      className="flex w-full items-center px-4 py-2 text-sm text-[#58718a] hover:bg-[#eef4fa] dark:text-[#d5e6f6] dark:hover:bg-[#132131]"
                    >
                      <span>{t("sign_in")}</span>
                    </button>
                  )}

                  {user && (
                    <button
                      onClick={async () => {
                        try {
                          await logout();
                          setIsUserMenuOpen(false);
                        } catch (error) {
                          console.error("Logout failed:", error);
                        }
                      }}
                      className="flex w-full items-center px-4 py-2 text-sm text-[#d05656] hover:bg-[#f4effb] dark:text-[#ff8d8d] dark:hover:bg-white/[0.04]"
                    >
                      <span>{t("logout")}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </nav>


      <PaymentModelDialog
        path={pathname}
        isOpen={openPaymentModel}
        onClose={() => setOpenPaymentModel(false)}
        onSelectPlan={(plan) => {
          console.log("Selected plan:", plan);
          setOpenPaymentModel(false);
        }}
        setIsDialogOpen={setIsDialogOpen}
        onStandardPlanClick={() => {
          console.log("🔥 Mobile sidebar handling free plan click");
          if (localStorage.getItem("termsAgreed") === "true") {
            console.log("✅ Terms agreed, closing PaymentDialog");
            setOpenPaymentModel(false);
            if (!user) {
              setTimeout(() => {
                setIsDialogOpen(true);
              }, 300);
            }
          } else {
            console.log("❌ Terms not agreed, showing terms first");
            // setShowTerms(true);
            // setPendingLogin(true);
          }
        }}
      />
    </>
  );
};

export default MobileSidebar;
