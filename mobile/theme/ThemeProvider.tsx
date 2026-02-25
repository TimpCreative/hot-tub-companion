import React, { createContext, useContext } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { colors as defaultColors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

interface ThemeContextType {
  colors: typeof defaultColors & { primary?: string; secondary?: string };
  typography: typeof typography;
  spacing: typeof spacing;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: defaultColors,
  typography,
  spacing,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { config } = useTenant();
  const themeColors = {
    ...defaultColors,
    primary: config?.branding?.primaryColor || defaultColors.primary,
    secondary: config?.branding?.secondaryColor || defaultColors.secondary,
  };
  return (
    <ThemeContext.Provider value={{ colors: themeColors, typography, spacing }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
