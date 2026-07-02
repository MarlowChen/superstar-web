'use server'

type Theme = "light" | "dark";

import { cookies } from 'next/headers'

export async function getTheme(): Promise<Theme> {
  const cookieStore = cookies()
  return cookieStore.get('theme')?.value as Theme ?? 'dark'
}

export async function setTheme(theme: Theme) {
  const cookieStore = cookies()
  cookieStore.set('theme', theme, { maxAge: 60 * 60 * 24 * 365 })
}
