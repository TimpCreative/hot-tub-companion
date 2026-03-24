import React, { createContext, useContext, useMemo } from 'react';
import { useTenant } from '../contexts/TenantContext';
import * as colorsModule from './colors';
import * as typographyModule from './typography';
import * as spacingModule from './spacing';

const defaultColors = colorsModule.colors;
const typography = typographyModule.typography;
const spacing = spacingModule.spacing;

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
  const themeColors = useMemo(
    () => ({
      ...defaultColors,
      primary: config?.branding?.primaryColor ?? defaultColors.primary,
      secondary: config?.branding?.secondaryColor ?? defaultColors.secondary,
    }),
    [
      config?.branding?.primaryColor,
      config?.branding?.secondaryColor,
    ]
  );
  const value = useMemo(
    () => ({ colors: themeColors, typography, spacing }),
    [themeColors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
