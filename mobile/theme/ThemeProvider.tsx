import React, { createContext, useContext, useMemo } from 'react';
import { postAgentDebug } from '../debug-react-runtime';
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
  // #region agent log
  postAgentDebug({
    hypothesisId: 'H2',
    location: 'ThemeProvider.tsx:entry',
    message: 'ThemeProvider render entry',
    data: { reactVersion: React.version },
  });
  // #endregion
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
