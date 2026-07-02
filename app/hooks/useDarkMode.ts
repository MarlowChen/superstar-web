import { useState, useEffect } from 'react'

const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true'
    setIsDarkMode(isDark)
  }, [])

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode
    localStorage.setItem('darkMode', newDarkMode.toString())
    setIsDarkMode(newDarkMode)
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return { isDarkMode, toggleDarkMode }
}

export default useDarkMode