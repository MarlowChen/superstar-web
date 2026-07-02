/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Info,
  Search,
  Filter,
  ChevronDown,
  X,
  Sparkles,
  Grid3x3,
  Plus,
  EyeOff,
  Menu,
} from "lucide-react";
import { useInView } from "react-intersection-observer";
import { useDebounce } from "use-debounce";
import Image from "next/image";
import {
  Style,
  StyleCategory,
  Workflow,
} from "@/app/services/styleSwitcherApi";
import { useLocale, useTranslations } from "next-intl";
import { TbLayoutListFilled } from "react-icons/tb";

interface Category {
  id: string;
  name: {
    [key: string]: string;
  };
}

interface StyleSelectionProps {
  onSelectStyle: (style: Style) => void;
  toggleSelectedStyle: (style: Style) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

interface TagDisplayState {
  [styleId: string]: boolean;
}

const StyleSelection: React.FC<StyleSelectionProps> = ({
  onSelectStyle,
  toggleSelectedStyle,
  scrollContainerRef,
}) => {
  const lng = useLocale();
  const [styles, setStyles] = useState<Style[]>([]);
  const [categories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = useState(true);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [tagDisplayState, setTagDisplayState] = useState<TagDisplayState>({});
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<string>("all");
  const t = useTranslations("styles");

  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
    root: scrollContainerRef?.current ?? undefined,
  });

  // 解析風格的分類標籤
  const parseStyleCategories = useCallback(
    (styleCategories: string | StyleCategory[]): Category[] => {
      try {
        if (typeof styleCategories === "string") {
          let parsed = styleCategories;

          // 調試信息
          if (process.env.NODE_ENV === "development") {
            // console.log("parseStyleCategories input:", styleCategories);
          }

          if (parsed.startsWith('"') && parsed.endsWith('"')) {
            parsed = parsed.slice(1, -1);
          }

          parsed = parsed.replace(/\\\"/g, '"').replace(/\\\\/g, "\\");

          // 調試信息
          if (process.env.NODE_ENV === "development") {
            // console.log("parseStyleCategories parsed:", parsed);
          }

          const categories = JSON.parse(parsed);

          // 調試信息
          if (process.env.NODE_ENV === "development") {
            // console.log("parseStyleCategories categories:", categories);
          }

          if (Array.isArray(categories)) {
            return categories.map((cat) => ({
              id: cat.id,
              name: cat.name, // 保持原始格式，不進行轉換
            }));
          }
          return [];
        }
        if (Array.isArray(styleCategories)) {
          return styleCategories.map((cat) => ({
            id: cat.id,
            name: cat.name, // 保持原始格式，不進行轉換
          }));
        }
        return [];
      } catch (error) {
        console.error(
          "Error parsing style categories:",
          error,
          "Input:",
          styleCategories
        );
        return [];
      }
    },
    []
  );

  // 解析工作流程數據
  const parseWorkflow = useCallback(
    (workflow: string | Workflow | undefined) => {
      try {
        if (typeof workflow === "string") {
          return JSON.parse(workflow);
        }
        return workflow;
      } catch (error) {
        console.error("Error parsing workflow:", error);
        return null;
      }
    },
    []
  );

  // 獲取工作流程分類
  const workflowTabs = useMemo(() => {
    const workflowMap = new Map<string, number>();

    styles.forEach((style) => {
      const parsedWorkflow = parseWorkflow(style.workflow);
      const workflowName = parsedWorkflow?.name || t("other");
      workflowMap.set(workflowName, (workflowMap.get(workflowName) || 0) + 1);
    });

    const tabs = [{ name: "all", label: t("all"), count: styles.length }];

    Array.from(workflowMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([name, count]) => {
        tabs.push({ name, label: name, count });
      });

    return tabs;
  }, [styles, parseWorkflow]);

  // 過濾後的風格
  const filteredStyles = useMemo(() => {
    let filtered = styles;

    // 調試信息 - 簡化版本
    if (process.env.NODE_ENV === "development") {
      console.log("🔍 filteredStyles calculation:", {
        initialStylesLength: styles.length,
        activeWorkflowTab,
        selectedCategoriesLength: selectedCategories.length,
        debouncedSearchTerm: debouncedSearchTerm || t("none"),
      });
    }

    // 工作流程篩選
    if (activeWorkflowTab !== "all") {
      filtered = filtered.filter((style) => {
        const parsedWorkflow = parseWorkflow(style.workflow);
        const workflowName = parsedWorkflow?.name || t("other");
        return workflowName === activeWorkflowTab;
      });
    }

    // 分類篩選
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((style) => {
        try {
          const styleCategories = parseStyleCategories(
            style.styleCategories as string
          );

          // 簡化調試信息
          if (process.env.NODE_ENV === "development" && filtered.length < 5) {
            console.log(`🎯 Style ${style.id} (${style.title}):`, {
              categories: styleCategories.map((c) => c.id),
              selected: selectedCategories,
              hasMatch: selectedCategories.some((catId) =>
                styleCategories.some((cat) => cat.id === catId)
              ),
            });
          }

          return selectedCategories.some((catId) =>
            styleCategories.some((cat) => cat.id === catId)
          );
        } catch (error) {
          console.error(`❌ Error filtering style ${style.id}:`, error);
          return false;
        }
      });
    }

    // 搜索篩選
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (style) =>
          style.title.toLowerCase().includes(searchLower) ||
          (style.description &&
            style.description.toLowerCase().includes(searchLower))
      );
    }

    const result = filtered.sort((a, b) => a.title.localeCompare(b.title));

    // 調試信息 - 簡化版本
    if (process.env.NODE_ENV === "development") {
      console.log("✅ filteredStyles result:", {
        finalLength: result.length,
        firstFew: result.slice(0, 3).map((s) => s.title),
      });
    }

    return result;
  }, [
    styles,
    activeWorkflowTab,
    selectedCategories,
    debouncedSearchTerm,
    parseStyleCategories,
    parseWorkflow,
  ]);

  // 切換標籤顯示狀態
  const toggleTagDisplay = useCallback((styleId: string) => {
    setTagDisplayState((prev) => ({
      ...prev,
      [styleId]: !prev[styleId],
    }));
  }, []);



  // 重置狀態當搜索條件改變
  useEffect(() => {
    setStyles([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    setShouldFetch(true);
    setTagDisplayState({});
  }, [debouncedSearchTerm, selectedCategories]);

  // 獲取風格數據
  const fetchStyles = useCallback(async () => {
    if (!shouldFetch || loading || !hasMore) return;

    setLoading(true);
    setShouldFetch(false);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/style-switch/search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            page,
            categories: selectedCategories,
            search: debouncedSearchTerm,
            limit: 200,
            locale: lng,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to fetch styles");

      const data = await response.json();
      const newStyles = data.docs;

      setStyles((prev) => (page === 1 ? newStyles : [...prev, ...newStyles]));
      setHasMore(newStyles.length > 0);
    } catch (error) {
      console.error("Failed to fetch styles:", error);

      // 使用 mock 數據作為後備
      try {
        const mockResponse = await fetch("/mock-data/styles.json");
        const mockData = await mockResponse.json();

        // 調試信息
        if (process.env.NODE_ENV === "development") {
          console.log("📦 Using mock data:", {
            totalStyles: mockData.styles.docs.length,
            categories: mockData.categories.length,
          });
        }

        // 模擬分頁邏輯
        const allMockStyles = mockData.styles.docs;
        const startIndex = (page - 1) * 200;
        const endIndex = startIndex + 200;
        const newStyles = allMockStyles.slice(startIndex, endIndex);

        // 調試信息
        if (process.env.NODE_ENV === "development") {
          console.log("📄 Mock pagination:", {
            page,
            startIndex,
            endIndex,
            newStylesLength: newStyles.length,
            totalStyles: allMockStyles.length,
          });
        }

        setStyles((prev) => (page === 1 ? newStyles : [...prev, ...newStyles]));
        setHasMore(endIndex < allMockStyles.length);
        setError(null); // 清除錯誤狀態
      } catch (mockError) {
        console.error("Failed to load mock styles:", mockError);
        setError("Failed to fetch styles");
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }, [
    page,
    selectedCategories,
    debouncedSearchTerm,
    loading,
    hasMore,
    shouldFetch,
    lng,
  ]);

  // 觸發獲取
  useEffect(() => {
    if (shouldFetch) {
      fetchStyles();
    }
  }, [fetchStyles, shouldFetch]);

  // 調試 styles 狀態變化
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("📊 Styles state updated:", {
        stylesLength: styles.length,
        filteredStylesLength: filteredStyles.length,
        selectedCategories:
          selectedCategories.length > 0 ? selectedCategories : t("none"),
        activeWorkflowTab,
        searchTerm: debouncedSearchTerm || t("none"),
      });
    }
  }, [
    styles,
    filteredStyles,
    selectedCategories,
    activeWorkflowTab,
    debouncedSearchTerm,
  ]);

  // 無限滾動
  useEffect(() => {
    if (inView && hasMore && !loading) {
      setPage((prev) => prev + 1);
      setShouldFetch(true);
    }
  }, [inView, hasMore, loading]);

  // 監聽外部點擊
  useEffect(() => {
    if (!showCategoryDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest(".category-dropdown-container")
      ) {
        setShowCategoryDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCategoryDropdown]);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleCategorySelect = (categoryId: string | null) => {
    if (categoryId === null) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories((prev) => {
        const isSelected = prev.includes(categoryId);
        if (isSelected) {
          return prev.filter((id) => id !== categoryId);
        } else {
          return [...prev, categoryId];
        }
      });
    }
    if (window.innerWidth < 1280) {
      setShowMobileFilters(false);
    }
  };

  // 工具函數：取得分類名稱
  const getCategoryName = useCallback(
    (category: Category): string => {
      if (!category) {
        console.warn("getCategoryName: category is null/undefined");
        return "";
      }

      if (!category.name) {
        console.warn("getCategoryName: category.name is missing", category);
        return category.id || "";
      }

      // 如果是字串，直接返回
      if (typeof category.name === "string") {
        return category.name;
      }

      // 如果是物件，嘗試獲取當前語系的名稱
      if (typeof category.name === "object" && category.name !== null) {
        if (category.name[lng]) {
          return category.name[lng];
        }

        const availableValues = Object.values(category.name).filter(
          (value) => typeof value === "string" && value.trim() !== ""
        );

        if (availableValues.length > 0) {
          return availableValues[0];
        }
      }

      console.warn(
        "getCategoryName: unable to extract name, using id",
        category
      );
      return category.id || "Unknown Category";
    },
    [lng]
  );

  const filteredCategories = categories.filter((category) => {
    const name = getCategoryName(category);
    return name.toLowerCase().includes(categorySearchTerm.toLowerCase());
  });

  // 使用 useMemo 優化動態翻譯文本
  const categoryButtonText = useMemo(
    () =>
      selectedCategories.length === 0
        ? t("all_categories_count", { count: categories.length })
        : t("selected_categories_count", { count: selectedCategories.length }),
    [t, selectedCategories.length, categories.length]
  );

  // 智能標籤顯示組件
  const SmartTagDisplay: React.FC<{
    categories: Category[];
    styleId: string;
    maxInitialTags?: number;
  }> = ({ categories, styleId, maxInitialTags = 3 }) => {
    const isExpanded = tagDisplayState[styleId] || false;
    const shouldShowExpand = categories.length > maxInitialTags;
    const displayCategories = isExpanded
      ? categories
      : categories.slice(0, maxInitialTags);
    const hiddenCount = categories.length - maxInitialTags;

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {displayCategories.map((category, index) => (
            <span
              key={`${category.id}-${index}`}
              className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full 
                       bg-gradient-to-r from-custom-logo-purple/10 to-custom-logo-purple/20 
                       dark:from-custom-logo-purple-dark/10 dark:to-custom-logo-purple-dark/20
                       text-custom-logo-purple dark:text-custom-logo-purple-dark 
                       border border-custom-logo-purple/20 dark:border-custom-logo-purple-dark/20
                       hover:from-custom-logo-purple/20 hover:to-custom-logo-purple/30
                       dark:hover:from-custom-logo-purple-dark/20 dark:hover:to-custom-logo-purple-dark/30
                       transition-all duration-200 cursor-default"
            >
              {getCategoryName(category)}
            </span>
          ))}

          {shouldShowExpand && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleTagDisplay(styleId);
              }}
              className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full
                       bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
                       text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100
                       border border-gray-200 dark:border-gray-600
                       transition-all duration-200 group"
            >
              {isExpanded ? (
                <>
                  <EyeOff className="w-3 h-3 mr-1 group-hover:scale-110 transition-transform" />
                  {t("collapse")}
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3 mr-1 group-hover:scale-110 transition-transform" />
                  {hiddenCount}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      {/* 頁面標題區域 */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div
            className="p-2 sm:p-3 bg-gradient-to-r from-custom-logo-purple to-custom-logo-purple-hover 
                        dark:from-custom-logo-purple-dark dark:to-custom-logo-purple-hover-dark 
                        rounded-xl shadow-lg"
          >
            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-custom-white" />
          </div>
          <h1
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-custom-black to-custom-logo-purple 
                        dark:from-custom-black-dark dark:to-custom-logo-purple-dark bg-clip-text text-transparent"
          >
            {t("style_gallery_title")}
          </h1>
        </div>
        <p className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto px-4">
          {t("explore_description")}
        </p>
      </div>

      {/* 工作流程 Tab 導航 */}
      {workflowTabs.length > 1 && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 p-1 bg-custom-gray dark:bg-custom-gray-dark rounded-xl border border-custom-light-purple dark:border-custom-light-purple-dark">
            {workflowTabs.map((tab) => (
              <button
                key={tab.name}
                onClick={() => setActiveWorkflowTab(tab.name)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                  activeWorkflowTab === tab.name
                    ? "bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-white shadow-md"
                    : "text-custom-black dark:text-custom-black-dark hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark"
                }`}
              >
                {tab.label}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    activeWorkflowTab === tab.name
                      ? "bg-white/20 text-white"
                      : "bg-custom-light-purple dark:bg-custom-light-purple-dark text-custom-black dark:text-custom-black-dark"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 搜索和篩選區域 */}
      <div
        className="relative z-[19] bg-custom-white dark:bg-custom-white-dark rounded-xl sm:rounded-2xl shadow-xl border border-custom-light-purple dark:border-custom-light-purple-dark p-4 sm:p-6 mb-4 sm:mb-6
                    backdrop-blur-lg bg-opacity-90 dark:bg-opacity-90"
      >
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* 手機版頂部控制列 */}
          <div className="flex xl:hidden items-center gap-3">
            {/* 搜索框 - 手機版 */}
            <div className="relative flex-grow group">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 
                               group-hover:text-custom-logo-purple dark:group-hover:text-custom-logo-purple-dark 
                               transition-colors duration-300 w-4 h-4"
              />
              <input
                type="text"
                placeholder={t("search_style_placeholder")}
                className="w-full pl-10 pr-3 py-3 bg-custom-gray dark:bg-custom-gray-dark 
                         text-custom-black dark:text-custom-black-dark 
                         border-2 border-custom-light-purple dark:border-custom-light-purple-dark rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-custom-logo-purple/20 focus:border-custom-logo-purple 
                         dark:focus:border-custom-logo-purple-dark hover:border-custom-logo-purple-hover 
                         dark:hover:border-custom-logo-purple-hover-dark transition-all duration-300
                         placeholder-gray-500 text-sm font-medium"
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>

            {/* 手機版篩選按鈕 */}
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="flex items-center gap-2 px-4 py-3 
                       bg-custom-gray dark:bg-custom-gray-dark 
                       hover:bg-custom-light-purple-hover dark:hover:bg-custom-light-purple-hover-dark 
                       text-custom-black dark:text-custom-black-dark 
                       rounded-lg border-2 border-custom-light-purple dark:border-custom-light-purple-dark 
                       hover:border-custom-logo-purple dark:hover:border-custom-logo-purple-dark 
                       transition-all duration-300 group min-w-[80px] font-medium shadow-sm"
            >
              <Menu size={16} />
              <span className="text-sm">{t("filters")}</span>
              {selectedCategories.length > 0 && (
                <span className="bg-custom-logo-purple text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {selectedCategories.length}
                </span>
              )}
            </button>
          </div>

          {/* 桌面版搜索和篩選 */}
          <div className="hidden xl:flex xl:flex-row gap-4">
            {/* 搜索框 - 桌面版 */}
            <div className="relative flex-grow group">
              <Search
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 
                               group-hover:text-custom-logo-purple dark:group-hover:text-custom-logo-purple-dark 
                               transition-colors duration-300 w-5 h-5"
              />
              <input
                type="text"
                placeholder={t("search_style_placeholder")}
                className="w-full pl-12 pr-4 py-4 bg-custom-gray dark:bg-custom-gray-dark 
                         text-custom-black dark:text-custom-black-dark 
                         border-2 border-custom-light-purple dark:border-custom-light-purple-dark rounded-xl
                         focus:outline-none focus:ring-4 focus:ring-custom-logo-purple/20 focus:border-custom-logo-purple 
                         dark:focus:border-custom-logo-purple-dark hover:border-custom-logo-purple-hover 
                         dark:hover:border-custom-logo-purple-hover-dark transition-all duration-300
                         placeholder-gray-500 text-lg font-medium"
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>

            {/* 分類篩選 - 桌面版 */}
            <div className="relative category-dropdown-container">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="flex items-center gap-2 px-4 py-4 bg-custom-gray dark:bg-custom-gray-dark 
                         hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark 
                         text-custom-black dark:text-custom-black-dark 
                         rounded-xl border-2 border-custom-light-purple dark:border-custom-light-purple-dark 
                         hover:border-custom-logo-purple dark:hover:border-custom-logo-purple-dark 
                         transition-all duration-300 group min-w-[200px] font-medium shadow-sm"
              >
                <Filter className="w-5 h-5" />
                <span className="text-sm">{categoryButtonText}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    showCategoryDropdown ? "rotate-180" : ""
                  }`}
                />
                {selectedCategories.length > 0 && (
                  <span className="bg-custom-logo-purple text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {selectedCategories.length}
                  </span>
                )}
              </button>

              {/* 分類下拉選單 */}
              {showCategoryDropdown && (
                <div
                  className="absolute top-full left-0 right-0 mt-2 bg-custom-white dark:bg-custom-white-dark 
                              rounded-xl shadow-xl border border-custom-light-purple dark:border-custom-light-purple-dark 
                              z-20 max-h-80 overflow-hidden"
                >
                  {/* 搜索分類 */}
                  <div className="p-3 border-b border-custom-light-purple dark:border-custom-light-purple-dark">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        placeholder={t("search_categories_placeholder")}
                        value={categorySearchTerm}
                        onChange={(e) => setCategorySearchTerm(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 bg-custom-gray dark:bg-custom-gray-dark 
                                 text-custom-black dark:text-custom-black-dark 
                                 border border-custom-light-purple dark:border-custom-light-purple-dark rounded-lg
                                 focus:outline-none focus:ring-2 focus:ring-custom-logo-purple/20 focus:border-custom-logo-purple 
                                 dark:focus:border-custom-logo-purple-dark text-sm"
                      />
                    </div>
                  </div>

                  {/* 分類列表 */}
                  <div className="max-h-60 overflow-y-auto">
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map((category) => {
                        const isSelected = selectedCategories.includes(
                          category.id
                        );
                        return (
                          <div
                            key={category.id}
                            className="flex items-center px-4 py-3 hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark 
                                     cursor-pointer transition-colors duration-200"
                            onClick={() => handleCategorySelect(category.id)}
                          >
                            <div
                              className={`w-4 h-4 rounded border-2 mr-3 flex items-center justify-center transition-all duration-200 ${
                                isSelected
                                  ? "bg-custom-logo-purple dark:bg-custom-logo-purple-dark border-custom-logo-purple dark:border-custom-logo-purple-dark"
                                  : "border-custom-light-purple dark:border-custom-light-purple-dark"
                              }`}
                            >
                              {isSelected && (
                                <div className="w-2 h-2 bg-white rounded-sm"></div>
                              )}
                            </div>
                            <span
                              className={`text-sm transition-colors duration-200 ${
                                isSelected
                                  ? "text-custom-logo-purple dark:text-custom-logo-purple-dark font-medium"
                                  : "text-custom-black dark:text-custom-black-dark"
                              }`}
                            >
                              {getCategoryName(category)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {t("no_categories_found")}
                      </div>
                    )}
                  </div>

                  {/* 清除選擇按鈕 */}
                  {selectedCategories.length > 0 && (
                    <div className="p-4 border-t border-custom-light-purple dark:border-custom-light-purple-dark">
                      <button
                        onClick={() => {
                          setSelectedCategories([]);
                          setShowCategoryDropdown(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-custom-logo-purple hover:text-custom-logo-purple-hover 
                                 dark:text-custom-logo-purple-dark dark:hover:text-custom-logo-purple-hover-dark 
                                 bg-custom-light-purple hover:bg-custom-light-purple-hover
                                 dark:bg-custom-light-purple-dark dark:hover:bg-custom-light-purple-hover-dark 
                                 rounded-xl transition-all duration-200 font-medium"
                      >
                        <X size={16} />
                        {t("clear_selection")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 視圖模式切換 */}
            <div className="flex bg-custom-gray dark:bg-custom-gray-dark rounded-xl p-1 border-2 border-custom-light-purple dark:border-custom-light-purple-dark">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                  viewMode === "grid"
                    ? "bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-white shadow-md"
                    : "text-gray-600 dark:text-gray-400 hover:text-custom-logo-purple dark:hover:text-custom-logo-purple-dark"
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
                {t("grid_view")}
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                  viewMode === "list"
                    ? "bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-white shadow-md"
                    : "text-gray-600 dark:text-gray-400 hover:text-custom-logo-purple dark:hover:text-custom-logo-purple-dark"
                }`}
              >
                <TbLayoutListFilled className="w-4 h-4" />
                {t("list_view")}
              </button>
            </div>
          </div>

          {/* 手機版篩選面板 */}
          {showMobileFilters && (
            <div className="xl:hidden bg-custom-white dark:bg-custom-white-dark rounded-xl border border-custom-light-purple dark:border-custom-light-purple-dark p-4">
              <div className="space-y-4">
                {/* 分類篩選 */}
                <div>
                  <h4 className="font-medium mb-3 text-custom-black dark:text-custom-black-dark flex items-center">
                    <Filter className="w-4 h-4 mr-2" />
                    {t("popular_categories")}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {categories.slice(0, 8).map((category) => {
                      const isSelected = selectedCategories.includes(
                        category.id
                      );
                      return (
                        <button
                          key={category.id}
                          onClick={() => handleCategorySelect(category.id)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            isSelected
                              ? "bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-white"
                              : "bg-custom-light-purple/30 dark:bg-custom-light-purple-dark/30 text-custom-black dark:text-custom-black-dark hover:bg-custom-light-purple/50 dark:hover:bg-custom-light-purple-dark/50"
                          }`}
                        >
                          {getCategoryName(category)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 清除選擇按鈕 */}
                {selectedCategories.length > 0 && (
                  <div className="pt-4 border-t border-custom-light-purple dark:border-custom-light-purple-dark">
                    <button
                      onClick={() => {
                        setSelectedCategories([]);
                        setShowMobileFilters(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 text-custom-logo-purple hover:text-custom-logo-purple-hover 
                               dark:text-custom-logo-purple-dark dark:hover:text-custom-logo-purple-hover-dark 
                               bg-custom-light-purple hover:bg-custom-light-purple-hover
                               dark:bg-custom-light-purple-dark dark:hover:bg-custom-light-purple-hover-dark 
                               rounded-xl transition-all duration-200 font-medium"
                    >
                      <X size={16} />
                      {t("clear_selection")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 已選類別顯示 */}
      {selectedCategories.length > 0 && (
        <div
          className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-custom-light-purple/50 to-custom-light-purple/70 
                      dark:from-custom-light-purple-dark/50 dark:to-custom-light-purple-dark/70 
                      rounded-xl sm:rounded-2xl border border-custom-logo-purple/20 dark:border-custom-logo-purple-dark/20 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-sm font-semibold text-custom-logo-purple dark:text-custom-logo-purple-dark flex items-center gap-2">
              <div className="w-2 h-2 bg-custom-logo-purple dark:bg-custom-logo-purple-dark rounded-full"></div>
              {t("selected_categories_label")}:
            </h3>
            <button
              onClick={() => setSelectedCategories([])}
              className="text-custom-logo-purple hover:text-custom-logo-purple-hover dark:text-custom-logo-purple-dark dark:hover:text-custom-logo-purple-hover-dark"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedCategories.map((catId) => {
              const category = categories.find((c) => c.id === catId);
              return (
                <span
                  key={catId}
                  className="text-xs sm:text-sm bg-custom-white dark:bg-custom-white-dark text-custom-logo-purple dark:text-custom-logo-purple-dark 
                           px-3 py-1.5 sm:px-4 sm:py-2 rounded-full flex items-center gap-2 shadow-sm border border-custom-logo-purple/20 dark:border-custom-logo-purple-dark/20"
                >
                  {category ? getCategoryName(category) : ""}
                  <button
                    onClick={() => handleCategorySelect(catId)}
                    className="text-custom-logo-purple hover:text-custom-logo-purple-hover dark:text-custom-logo-purple-dark dark:hover:text-custom-logo-purple-hover-dark"
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 風格展示區域 */}
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            : "space-y-4"
        }
      >
        {filteredStyles.map((style) => {
          const styleCategories = parseStyleCategories(
            style.styleCategories as string
          );

          if (viewMode === "list") {
            // 列表視圖
            return (
              <div
                key={style.id}
                className="group bg-custom-white dark:bg-custom-white-dark rounded-xl sm:rounded-2xl shadow-lg hover:shadow-2xl 
                         transition-all duration-300 hover:-translate-y-1 sm:hover:-translate-y-2 border border-custom-light-purple dark:border-custom-light-purple-dark
                         flex gap-3 sm:gap-4 lg:gap-6 p-3 sm:p-4 lg:p-6 cursor-pointer xl:cursor-default"
                onClick={() => {
                  if (window.innerWidth < 1280) {
                    toggleSelectedStyle(style);
                  }
                }}
              >
                <div className="w-24 h-24 sm:w-32 sm:h-32 lg:w-48 lg:h-48 flex-shrink-0 relative overflow-hidden rounded-lg sm:rounded-xl">
                  {style && style.cover && (
                    <Image
                      src={
                        (JSON.parse(style.cover as string))?.url || ""
                      }
                      alt={style.title}
                      layout="fill"
                      objectFit="cover"
                      objectPosition="center"
                      className="group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <h3
                      className="text-base sm:text-lg lg:text-2xl font-bold text-custom-black dark:text-custom-black-dark mb-2 sm:mb-3 
                                 group-hover:text-custom-logo-purple dark:group-hover:text-custom-logo-purple-dark transition-colors duration-300
                                 line-clamp-2"
                    >
                      {style.title}
                    </h3>

                    {/* 列表模式的標籤顯示 */}
                    {styleCategories.length > 0 && (
                      <div className="mb-3 sm:mb-4">
                        <SmartTagDisplay
                          categories={styleCategories}
                          styleId={style.id}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {/* 桌面版才顯示詳情按鈕 */}
                    <div className="hidden xl:flex items-center gap-2 sm:gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectedStyle(style);
                        }}
                        className="p-2 sm:p-3 bg-custom-gray dark:bg-custom-gray-dark hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark 
                                 rounded-lg sm:rounded-xl transition-colors duration-200 shadow-sm"
                      >
                        <Info
                          size={16}
                          className="sm:w-[18px] sm:h-[18px] text-custom-logo-purple dark:text-custom-logo-purple-dark"
                        />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-2 sm:px-6 sm:py-3 lg:px-8 lg:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold bg-gradient-to-r from-custom-logo-purple to-custom-logo-purple-hover 
                               dark:from-custom-logo-purple-dark dark:to-custom-logo-purple-hover-dark 
                               text-custom-white hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStyle(style);
                      }}
                    >
                      <span className="hidden sm:inline">
                        {t("select_style")}
                      </span>
                      <span className="sm:hidden">{t("select")}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // 網格視圖
          return (
            <div
              key={style.id}
              className="group bg-custom-white dark:bg-custom-white-dark rounded-xl sm:rounded-2xl shadow-lg hover:shadow-2xl 
                       transition-all duration-300 hover:-translate-y-1 sm:hover:-translate-y-2 border border-custom-light-purple dark:border-custom-light-purple-dark
                       hover:border-custom-logo-purple/50 dark:hover:border-custom-logo-purple-dark/50 flex flex-col justify-between
                       cursor-pointer xl:cursor-default"
              onClick={() => {
                if (window.innerWidth < 1280) {
                  toggleSelectedStyle(style);
                }
              }}
            >
              <div
                style={{ aspectRatio: "1 / 1" }}
                className="w-full relative overflow-hidden"
              >
                {style && style.cover && (
                  <Image
                    src={(JSON.parse(style.cover as string))?.url || ""}
                    alt={style.title}
                    layout="fill"
                    objectFit="cover"
                    objectPosition="center"
                    className="group-hover:scale-110 transition-transform duration-500"
                  />
                )}

                {/* 懸停效果遮罩 */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent 
                            opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                />

                {/* 桌面版懸停時的操作按鈕 */}
                <div className="hidden xl:block absolute top-2 right-2 sm:top-4 sm:right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectedStyle(style);
                    }}
                    className="p-2 sm:p-3 bg-white/95 dark:bg-black/90 backdrop-blur-md rounded-full 
                           hover:bg-white dark:hover:bg-black transition-colors duration-200 shadow-xl
                           hover:scale-110 transform"
                  >
                    <Info
                      size={16}
                      className="sm:w-[18px] sm:h-[18px] text-custom-logo-purple dark:text-custom-logo-purple-dark"
                    />
                  </button>
                </div>

                {/* 手機/平板的點擊提示 */}
                <div className="xl:hidden absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <div className="bg-white/90 dark:bg-black/90 backdrop-blur-md rounded-full px-4 py-2 transform scale-95 group-hover:scale-100 transition-transform duration-200">
                    <span className="text-sm font-medium text-custom-black dark:text-white flex items-center gap-2">
                      <Info size={16} />
                      {t("view_details")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-4 lg:p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3
                    className="text-sm sm:text-base lg:text-xl font-bold text-custom-black dark:text-custom-black-dark mb-2 sm:mb-3 
                             group-hover:text-custom-logo-purple dark:group-hover:text-custom-logo-purple-dark transition-colors duration-300
                             line-clamp-2 leading-tight"
                  >
                    {style.title}
                  </h3>

                  {/* 網格模式的標籤顯示 */}
                  {styleCategories.length > 0 && (
                    <div className="mb-3 sm:mb-4">
                      <SmartTagDisplay
                        categories={styleCategories}
                        styleId={style.id}
                        maxInitialTags={2}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex-1 px-3 py-2 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-custom-logo-purple to-custom-logo-purple-hover 
                           dark:from-custom-logo-purple-dark dark:to-custom-logo-purple-hover-dark 
                           text-custom-white hover:shadow-xl transition-all duration-300 transform hover:scale-105
                           hover:from-custom-logo-purple-hover hover:to-custom-logo-purple
                           dark:hover:from-custom-logo-purple-hover-dark dark:hover:to-custom-logo-purple-dark"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectStyle(style);
                    }}
                  >
                    <span className="hidden sm:inline">
                      {t("select_style")}
                    </span>
                    <span className="sm:hidden">{t("select")}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 載入狀態 */}
      {loading && (
        <div className="flex justify-center items-center py-12 sm:py-16">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-custom-light-purple dark:border-custom-light-purple-dark rounded-full animate-spin border-t-custom-logo-purple dark:border-t-custom-logo-purple-dark"></div>
              <div className="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 border-4 border-transparent border-r-custom-logo-purple/50 dark:border-r-custom-logo-purple-dark/50 rounded-full animate-spin animation-delay-300"></div>
            </div>
            <p className="mt-3 sm:mt-4 text-custom-black dark:text-custom-black-dark font-semibold text-base sm:text-lg">
              {t("loading_styles")}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
              {t("loading_subtitle")}
            </p>
          </div>
        </div>
      )}

      {/* 錯誤狀態 */}
      {error && (
        <div className="text-center py-8 sm:py-12">
          <div className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg sm:rounded-xl border border-red-200 dark:border-red-800">
            <X size={18} className="sm:w-5 sm:h-5" />
            <span className="font-medium text-sm sm:text-base">{error}</span>
          </div>
        </div>
      )}

      {/* 無限滾動觸發器 */}
      {hasMore && <div ref={ref} className="h-16 sm:h-20 mt-16 sm:mt-20" />}

      {/* 沒有更多內容 */}
      {!hasMore && filteredStyles.length > 0 && (
        <div className="text-center py-8 sm:py-12">
          <div
            className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-custom-light-purple/50 to-custom-light-purple/70 
                        dark:from-custom-light-purple-dark/50 dark:to-custom-light-purple-dark/70 rounded-full backdrop-blur-sm"
          >
            <div className="w-2 h-2 bg-custom-logo-purple dark:bg-custom-logo-purple-dark rounded-full animate-pulse"></div>
            <span className="text-custom-black dark:text-custom-black-dark text-xs sm:text-sm font-semibold">
              {t("total_styles_shown", { count: filteredStyles.length })}
            </span>
            <div className="w-2 h-2 bg-custom-logo-purple dark:bg-custom-logo-purple-dark rounded-full animate-pulse animation-delay-300"></div>
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 m-auto w-full">
            <div className="text-center">
              <div className="text-sm text-custom-black dark:text-custom-white">
                {t("copyright_notice")}
                {t("copyright_company")}
                {t("copyright_content")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 空狀態 */}
      {!loading && filteredStyles.length === 0 && !error && (
        <div className="text-center py-16 sm:py-20">
          <div
            className="max-w-sm sm:max-w-md mx-auto p-6 sm:p-8 bg-gradient-to-br from-custom-light-purple/30 to-custom-light-purple/50 
                        dark:from-custom-light-purple-dark/30 dark:to-custom-light-purple-dark/50 rounded-xl sm:rounded-2xl backdrop-blur-sm mx-4"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-custom-logo-purple/10 dark:bg-custom-logo-purple-dark/10 rounded-full flex items-center justify-center">
              <Grid3x3 className="w-8 h-8 sm:w-10 sm:h-10 text-custom-logo-purple dark:text-custom-logo-purple-dark opacity-60" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-custom-black dark:text-custom-black-dark mb-2 sm:mb-3">
              {t("no_styles_found")}
            </h3>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
              {t("no_styles_subtitle")}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategories([]);
                  setActiveWorkflowTab("all");
                }}
                className="px-4 py-2 sm:px-4 sm:py-2 bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-white rounded-lg text-sm font-medium
                         hover:bg-custom-logo-purple-hover dark:hover:bg-custom-logo-purple-hover-dark transition-colors duration-200"
              >
                {t("clear_all_filters")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StyleSelection;
