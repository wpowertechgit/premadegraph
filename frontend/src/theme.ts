import { createTheme } from "@mui/material/styles";
import type React from "react";

export const shellMetrics = {
  navHeight: "78px",
  contentMaxWidth: "1360px",
};

export const INTERPRETATION_PALETTE = {
  balanced: "#7fd2c3",
  unbalanced: "#ef9b7d",
  neutral: "#f0bb74",
} as const;

export const appTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#6b7cff",
      light: "#8b9aff",
      dark: "#5e6ad2",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#8bd6c2",
    },
    success: {
      main: "#10b981",
    },
    warning: {
      main: "#eab36c",
    },
    error: {
      main: "#f08a87",
    },
    background: {
      default: "#080a0c",
      paper: "#0d1117",
    },
    text: {
      primary: "#f7f8f8",
      secondary: "#8a8f98",
    },
    divider: "rgba(255, 255, 255, 0.06)",
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: "var(--font-body)",
    h1: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      letterSpacing: "-0.04em",
    },
    h2: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      letterSpacing: "-0.03em",
    },
    h3: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h4: {
      fontFamily: "var(--font-display)",
      fontWeight: 600,
    },
    button: {
      fontWeight: 600,
      textTransform: "none",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#080a0c",
          backgroundImage: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#0d1117",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.32)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          paddingInline: "0.9rem",
          minHeight: "36px",
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },
        containedPrimary: {
          background: "#5e6ad2",
          color: "#ffffff",
          "&:hover": {
            background: "#6b7cff",
          },
        },
        outlined: {
          borderColor: "rgba(255, 255, 255, 0.10)",
          "&:hover": {
            borderColor: "rgba(255, 255, 255, 0.18)",
            background: "rgba(255, 255, 255, 0.04)",
          },
        },
        text: {
          "&:hover": {
            background: "rgba(255, 255, 255, 0.04)",
          },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255, 255, 255, 0.03)",
          borderRadius: 6,
          border: "1px solid rgba(255, 255, 255, 0.08)",
          overflow: "hidden",
          "&:before, &:after": {
            display: "none",
          },
          "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.05)",
          },
          "&.Mui-focused": {
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            borderColor: "rgba(107, 124, 255, 0.5)",
            boxShadow: "0 0 0 3px rgba(107, 124, 255, 0.14)",
          },
        },
        input: {
          color: "#f7f8f8",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#8a8f98",
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          color: "#f7f8f8",
        },
        icon: {
          color: "#8a8f98",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: "rgba(255, 255, 255, 0.06)",
        },
        head: {
          color: "#d0d6e0",
          fontWeight: 600,
          backgroundColor: "rgba(255, 255, 255, 0.02)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          height: "22px",
          fontSize: "0.72rem",
          fontWeight: 600,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#1a2330",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 6,
          fontSize: "0.78rem",
        },
      },
    },
  },
});

export function pageShellStyle(fullBleed = false): React.CSSProperties {
  return {
    minHeight: fullBleed ? "calc(100vh - var(--nav-height))" : "auto",
    width: "100%",
    maxWidth: fullBleed ? "none" : shellMetrics.contentMaxWidth,
    margin: "0 auto",
    padding: fullBleed ? "0" : "1.5rem",
    boxSizing: "border-box",
  };
}

export function surfaceCardStyle(): React.CSSProperties {
  return {
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-card)",
    boxShadow: "var(--shadow-card)",
    color: "var(--text-primary)",
  };
}

export function glassCardStyle(): React.CSSProperties {
  return {
    borderRadius: "var(--radius-md)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "var(--surface-glass)",
    backdropFilter: "blur(12px)",
    boxShadow: "var(--shadow-card)",
    color: "var(--text-primary)",
  };
}

export function sectionLabelStyle(): React.CSSProperties {
  return {
    color: "var(--text-muted)",
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: "0.10em",
    fontWeight: 600,
  };
}

export function metricCardStyle(): React.CSSProperties {
  return {
    ...surfaceCardStyle(),
    padding: "0.85rem 1rem",
    display: "grid",
    gap: "0.3rem",
  };
}

export function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-strong)",
    background: "rgba(255, 255, 255, 0.03)",
    color: "var(--text-primary)",
    padding: "0.6rem 0.8rem",
    boxSizing: "border-box",
    outline: "none",
  };
}

export function buttonStyle(
  variant: "primary" | "secondary" | "ghost" | "danger" = "primary",
): React.CSSProperties {
  const variants: Record<typeof variant, React.CSSProperties> = {
    primary: {
      background: "#5e6ad2",
      color: "#ffffff",
      border: "1px solid rgba(107, 124, 255, 0.4)",
    },
    secondary: {
      background: "rgba(255, 255, 255, 0.04)",
      color: "var(--text-primary)",
      border: "1px solid var(--border-strong)",
    },
    ghost: {
      background: "rgba(255, 255, 255, 0.02)",
      color: "var(--text-primary)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
    },
    danger: {
      background: "rgba(240, 138, 135, 0.10)",
      color: "#ffd7d6",
      border: "1px solid rgba(240, 138, 135, 0.22)",
    },
  };

  return {
    minHeight: "36px",
    borderRadius: "var(--radius-sm)",
    padding: "0.55rem 0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    transition:
      "transform var(--motion-fast), border-color var(--motion-fast), background var(--motion-fast), opacity var(--motion-fast)",
    ...variants[variant],
  };
}
