'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  mounted: boolean
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Only runs on client
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('theme') as Theme | null
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
      const initialTheme = saved ?? (prefersDark ? 'dark' : 'light')
      
      setThemeState(initialTheme)
      document?.documentElement?.classList?.remove('light', 'dark')
      document?.documentElement?.classList?.add(initialTheme)
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setThemeState(newTheme)
    if (typeof window !== 'undefined') {
      localStorage?.setItem('theme', newTheme)
      document?.documentElement?.classList?.remove('light', 'dark')
      document?.documentElement?.classList?.add(newTheme)
    }
  }

  const setThemeDirect = (t: Theme) => {
    setThemeState(t)
    if (typeof window !== 'undefined') {
      localStorage?.setItem('theme', t)
      document?.documentElement?.classList?.remove('light', 'dark')
      document?.documentElement?.classList?.add(t)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, mounted, toggleTheme, setTheme: setThemeDirect }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    return { theme: 'light', mounted: false, toggleTheme: () => {}, setTheme: () => {} }
  }
  return context
}
