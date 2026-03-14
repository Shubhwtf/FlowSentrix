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
                'fs-cyan': '#00D4FF',
                'fs-bg-dark': '#0A0A0B',
                'fs-surface-dark': '#111113',
                'fs-border-dark': '#1C1C1E',
                'fs-text-dark': '#F2F2F0',
                'fs-bg-light': '#FAFAF9',
                'fs-surface-light': '#F4F4F5',
                'fs-border-light': '#E4E4E7',
                'fs-text-light': '#0F0F0F',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'monospace'],
            }
        },
    },
    plugins: [],
}
export default config
