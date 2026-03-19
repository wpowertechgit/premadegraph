import { createTheme } from "@mui/material/styles";
import type React from "react";

export const shellMetrics = {
  navHeight: "78px",
  contentMaxWidth: "1360px",
};

export const appTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#66b8ff",
      light: "#9dd4ff",
      dark: "#2d78b4",
      contrastText: "#071019",
    },
    secondary: {
      main: "#8bd6c2",
    },
    success: {
      main: "#71d79b",
    },
    warning: {
      main: "#eab36c",
    },
    error: {
      main: "#f08a87",
    },
    background: {
      default: "#071019",
      paper: "#0f1b27",
    },
    text: {
      primary: "#f5f8fc",
      secondary: "#9bb1c7",
    },
    divider: "rgba(126, 155, 183, 0.18)",
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: 'var(--font-body)',
    h1: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      letterSpacing: "-0.04em",
    },
    h2: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      letterSpacing: "-0.03em",
    },
    h3: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h4: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
    },
    button: {
      fontWeight: 700,
      textTransform: "none",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background:
            "radial-gradient(circle at top, rgba(28, 57, 89, 0.55) 0%, rgba(7, 16, 25, 0.98) 42%, #04080d 100%)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(126, 155, 183, 0.18)",
          boxShadow: "0 24px 56px rgba(0, 0, 0, 0.24)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          paddingInline: "1rem",
          minHeight: "46px",
        },
        containedPrimary: {
          background:
            "linear-gradient(135deg, rgba(88, 183, 255, 0.96) 0%, rgba(127, 220, 255, 0.92) 100%)",
          color: "#06131b",
          boxShadow: "0 18px 32px rgba(36, 102, 149, 0.28)",
        },
        outlined: {
          borderColor: "rgba(126, 155, 183, 0.24)",
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(11, 22, 34, 0.82)",
          borderRadius: 14,
          border: "1px solid rgba(126, 155, 183, 0.16)",
          overflow: "hidden",
          "&:before, &:after": {
            display: "none",
          },
          "&:hover": {
            backgroundColor: "rgba(14, 27, 41, 0.92)",
          },
          "&.Mui-focused": {
            backgroundColor: "rgba(14, 27, 41, 0.98)",
            borderColor: "rgba(102, 184, 255, 0.5)",
            boxShadow: "0 0 0 3px rgba(102, 184, 255, 0.18)",
          },
        },
        input: {
          color: "#f5f8fc",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#93abc2",
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          color: "#f5f8fc",
        },
        icon: {
          color: "#93abc2",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: "rgba(126, 155, 183, 0.14)",
        },
        head: {
          color: "#dce9f6",
          fontWeight: 700,
          backgroundColor: "rgba(9, 17, 25, 0.82)",
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
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-card)",
    boxShadow: "var(--shadow-card)",
    color: "var(--text-primary)",
  };
}

export function glassCardStyle(): React.CSSProperties {
  return {
    borderRadius: "var(--radius-xl)",
    border: "1px solid rgba(126, 155, 183, 0.24)",
    background: "var(--surface-glass)",
    backdropFilter: "blur(18px)",
    boxShadow: "var(--shadow-card)",
    color: "var(--text-primary)",
  };
}

export function sectionLabelStyle(): React.CSSProperties {
  return {
    color: "var(--text-muted)",
    fontSize: "0.78rem",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontWeight: 700,
  };
}

export function metricCardStyle(): React.CSSProperties {
  return {
    ...surfaceCardStyle(),
    padding: "0.95rem 1rem",
    display: "grid",
    gap: "0.35rem",
  };
}

export function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border-strong)",
    background: "var(--surface-soft)",
    color: "var(--text-primary)",
    padding: "0.85rem 0.95rem",
    boxSizing: "border-box",
    outline: "none",
  };
}

export function buttonStyle(variant: "primary" | "secondary" | "ghost" | "danger" = "primary"): React.CSSProperties {
  const variants: Record<typeof variant, React.CSSProperties> = {
    primary: {
      background: "linear-gradient(135deg, rgba(88, 183, 255, 0.96) 0%, rgba(127, 220, 255, 0.92) 100%)",
      color: "#071019",
      border: "1px solid rgba(141, 221, 255, 0.55)",
      boxShadow: "0 18px 32px rgba(36, 102, 149, 0.28)",
    },
    secondary: {
      background: "rgba(15, 34, 50, 0.92)",
      color: "var(--text-primary)",
      border: "1px solid var(--border-strong)",
    },
    ghost: {
      background: "rgba(10, 19, 28, 0.62)",
      color: "var(--text-primary)",
      border: "1px solid rgba(126, 155, 183, 0.16)",
    },
    danger: {
      background: "rgba(57, 21, 24, 0.88)",
      color: "#ffd7d6",
      border: "1px solid rgba(240, 138, 135, 0.25)",
    },
  };

  return {
    minHeight: "46px",
    borderRadius: "var(--radius-md)",
    padding: "0.8rem 1rem",
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform var(--motion-fast), border-color var(--motion-fast), background var(--motion-fast), opacity var(--motion-fast)",
    ...variants[variant],
  };
}
