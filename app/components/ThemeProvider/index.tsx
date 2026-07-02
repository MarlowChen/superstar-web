"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { setTheme as setThemeAction } from "../../actions/theme";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ 
  children,
  initialTheme = "dark",
}: { 
  children: React.ReactNode;
  initialTheme?: Theme;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem("theme");
      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
        return;
      }

      const cookieTheme = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("theme="))
        ?.split("=")[1];

      if (cookieTheme === "light" || cookieTheme === "dark") {
        setTheme(cookieTheme);
        return;
      }

      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
      } else {
        setTheme("light");
      }
    } catch (error) {
      console.error("Error initializing theme:", error);
    }
  }, []);

  useEffect(() => {
    const applyTheme = async () => {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
        document.body.classList.add("dark");
        document.body.style.backgroundColor = "#0b1020";
        document.body.style.color = "#E7F1FB";
      } else {
        document.documentElement.classList.remove("dark");
        document.body.classList.remove("dark");
        document.body.style.backgroundColor = "#f6f7ff";
        document.body.style.color = "#10243A";
      }

      localStorage.setItem("theme", theme);
      await setThemeAction(theme);
    };

    applyTheme();
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => prevTheme === "light" ? "dark" : "light");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
