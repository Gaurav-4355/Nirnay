// Theme state management with Light, Dark, System modes
import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem('nirnay.theme') || 'light';
    } catch {
      return 'light';
    }
  });

  const [effectiveTheme, setEffectiveTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('nirnay.theme') || 'light';
      if (stored === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return stored;
    } catch {
      return 'light';
    }
  });

  const applyTheme = (targetEffective) => {
    // Disable transitions during theme switch for one frame
    document.documentElement.classList.add('no-transitions');
    document.documentElement.setAttribute('data-theme', targetEffective);
    document.documentElement.style.colorScheme = targetEffective;

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', targetEffective === 'dark' ? '#0C0F17' : '#FFFFFF');
    }

    setEffectiveTheme(targetEffective);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('no-transitions');
      });
    });
  };

  const setTheme = (newTheme) => {
    try {
      localStorage.setItem('nirnay.theme', newTheme);
    } catch (e) {
      console.warn('LocalStorage access blocked for theme', e);
    }
    setThemeState(newTheme);

    let targetEffective = newTheme;
    if (newTheme === 'system') {
      targetEffective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(targetEffective);
  };

  // Listen to system preference changes when in 'system' mode
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (theme === 'system') {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Initial sync on mount
  useEffect(() => {
    let targetEffective = theme;
    if (theme === 'system') {
      targetEffective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(targetEffective);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
