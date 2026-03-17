import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                background: 'var(--background)',
                surface: 'var(--surface)',
                'surface-elevated': 'var(--surface-elevated)',
                border: 'var(--border)',
                'border-subtle': 'var(--border-subtle)',
                'text-primary': 'var(--text-primary)',
                'text-secondary': 'var(--text-secondary)',
                'text-muted': 'var(--text-muted)',
                accent: 'var(--accent)',
                'accent-foreground': 'var(--accent-foreground)',
                destructive: 'var(--destructive)',
                success: 'var(--success)',
                warning: 'var(--warning)',
                'healing-active': 'var(--healing-active)',
                'fs-cyan': 'var(--text-primary)',
                'fs-bg-dark': 'var(--background)',
                'fs-surface-dark': 'var(--surface)',
                'fs-border-dark': 'var(--border)',
                'fs-text-dark': 'var(--text-primary)',
                'fs-bg-light': 'var(--background)',
                'fs-surface-light': 'var(--surface)',
                'fs-border-light': 'var(--border)',
                'fs-text-light': 'var(--text-primary)',
            },
            fontFamily: {
                sans: ['Geist', 'system-ui', 'sans-serif'],
                mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
            },
            borderRadius: {
                DEFAULT: '6px',
                sm: '4px',
                md: '6px',
                lg: '6px',
            },
            boxShadow: {
                subtle: '0 1px 3px rgba(0, 0, 0, 0.12)',
            },
            transitionDuration: {
                80: '80ms',
                120: '120ms',
                180: '180ms',
            },
        },
    },
    plugins: [],
}
export default config
