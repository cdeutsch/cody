/** @type {import('tailwindcss').Config} */
// cspell:ignore autoedit drivericons
import typography from '@tailwindcss/typography'
import plugin from 'tailwindcss/plugin'

export default {
    content: {
        relative: true,
        files: [
            '**/*.{ts,tsx}',
            '../../lib/**/**/*.{ts,tsx}',
            'autoedit-debug/**/*.{ts,tsx}',
            'autoedit-debug/**/*.css',
        ],
    },
    prefix: 'tw-',
    theme: {
        extend: {
            screens: {
                xs: '348px',
            },
            fontSize: {
                lg: 'calc(var(--vscode-font-size) * 15 / 13)', // = 15px
                md: 'var(--vscode-font-size)', // = 13px
                sm: 'calc(calc(12/13)*var(--vscode-font-size))', // = 12px
                xs: 'calc(calc(11/13)*var(--vscode-font-size))', // = 11px
                xxs: 'calc(calc(10/13)*var(--vscode-font-size))', // = 10px
            },
            fontFamily: {
                codyicons: ['cody-icons'],
            },
            spacing: {
                1: '2px',
                1.5: '3px',
                2: '4px',
                3: '6px',
                4: '8px',
                5: '10px',
                6: '12px',
                7: '14px',
                8: '16px',
                10: '20px',
                11: '22px',
                12: '24px',
                14: '28px',
                16: '32px',
                18: '36px',
                20: '40px',
                21: '44px',
            },
            border: {
                DEFAULT: '1px',
            },
            colors: {
                border: 'var(--vscode-dropdown-border)',
                ring: 'var(--vscode-focusBorder)',
                background: 'var(--vscode-editor-background)',
                foreground: 'var(--vscode-foreground)',
                icon: {
                    foreground: 'var(--vscode-icon-foreground)',
                    background: 'var(--vscode-icon-background)',
                    border: 'var(--vscode-icon-border)',
                },
                input: {
                    foreground: 'var(--vscode-input-foreground)',
                    background: 'var(--vscode-input-background)',
                    border: 'var(--vscode-input-border, transparent)',
                },
                button: {
                    background: {
                        DEFAULT: 'var(--vscode-button-background)',
                        hover: 'var(--vscode-button-hoverBackground)',
                    },
                    foreground: 'var(--vscode-button-foreground)',
                    border: 'var(--vscode-button-border, transparent)',
                    secondary: {
                        background: {
                            DEFAULT: 'var(--vscode-button-secondaryBackground)',
                            hover: 'var(--vscode-button-secondaryHoverBackground)',
                        },
                        foreground: 'var(--vscode-button-secondaryForeground)',
                    },
                },
                sidebar: {
                    background: 'var(--vscode-sideBar-background)',
                    foreground: 'var(--vscode-sideBar-foreground)',
                },
                muted: {
                    DEFAULT: 'var(--vscode-input-background)',
                    transparent: 'color-mix(in lch, currentColor 15%, transparent)',
                    foreground: 'var(--vscode-input-placeholderForeground)',
                },
                accent: {
                    DEFAULT: 'var(--vscode-list-activeSelectionBackground)',
                    foreground: 'var(--vscode-list-activeSelectionForeground)',
                },
                popover: {
                    DEFAULT: 'var(--vscode-quickInput-background)',
                    foreground: 'var(--vscode-dropdown-foreground)',
                },
                keybinding: {
                    foreground: 'var(--vscode-keybindingLabel-foreground)',
                    background: 'var(--vscode-keybindingLabel-background)',
                    border: 'var(--vscode-keybindingLabel-border)',
                },
                link: {
                    DEFAULT: 'var(--vscode-textLink-foreground)',
                    hover: 'var(--vscode-textLink-activeForeground)',
                },
                current: {
                    DEFAULT: 'currentColor',
                    25: 'color-mix(in lch, currentColor 25%, transparent)',
                },
                badge: {
                    border: 'var(--vscode-contrastBorder)',
                    foreground: 'var(--vscode-badge-foreground)',
                    background: 'var(--vscode-badge-background)',
                },
                'status-offline': {
                    background: 'var(--vscode-statusBarItem-offlineBackground)',
                    foreground: 'var(--vscode-statusBarItem-offlineForeground)',
                },
                code: {
                    background: 'var(--code-background)',
                    foreground: 'var(--code-foreground)',
                },
                driver: {
                    blue: '#00CBEC',
                    purple: '#A112FF',
                    orange: '#FF5543',
                },
                'status-bar-item-remote': {
                    background: 'var(--vscode-statusBarItem-remoteBackground)',
                    foreground: 'var(--vscode-statusBarItem-remoteForeground)',
                },
            },
            borderRadius: {
                lg: '6px',
                md: '4px',
                sm: '2px',
            },
            keyframes: {
                'accordion-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-accordion-content-height)' },
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: '0' },
                },
                'collapsible-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-collapsible-content-height)' },
                },
                'collapsible-up': {
                    from: { height: 'var(--radix-collapsible-content-height)' },
                    to: { height: '0' },
                },
                loading: {
                    '0%, 100%': { opacity: '0.2' },
                    '50%': { opacity: '1' },
                },
            },
            animation: {
                'accordion-down': 'accordion-down 0.15s ease-out',
                'accordion-up': 'accordion-up 0.15s ease-out',
                'collapsible-down': 'collapsible-down 0.15s ease-out',
                'collapsible-up': 'collapsible-up 0.15s ease-out',
            },
            typography: {
                DEFAULT: {
                    css: {
                        '--tw-prose-body': 'var(--vscode-interactive-session-foreground)',
                        '--tw-prose-headings': 'var(--vscode-interactive-session-foreground)',
                        '--tw-prose-lead': 'var(--vscode-interactive-session-foreground)',
                        '--tw-prose-links': 'var(--vscode-textLink-foreground)',
                        '--tw-prose-bold': 'var(--vscode-interactive-session-foreground)',
                        '--tw-prose-counters': 'var(--vscode-interactive-session-foreground)',
                        '--tw-prose-bullets': 'var(--vscode-interactive-session-foreground)',
                        '--tw-prose-hr': 'var(--vscode-interactive-session-foreground)',
                        '--tw-prose-quotes': 'var(--vscode-interactive-session-foreground)',
                        '--tw-prose-quote-borders': 'var(--vscode-interactive-session-foreground)',
                        '--tw-prose-captions': 'var(--vscode-interactive-session-foreground)',
                        '--tw-prose-code': 'var(--vscode-textPreformat-foreground)',
                        '--tw-prose-pre-code': 'var(--vscode-interactive-session-foreground)',
                        '--tw-prose-pre-bg': 'var(--vscode-interactive-session-background)',
                        '--tw-prose-th-borders': 'var(--vscode-interactive-session-foreground)',
                        '--tw-prose-td-borders': 'var(--vscode-interactive-session-foreground)',
                        // '--tw-prose-invert-body': 'var(--color-pink-200)',
                        // '--tw-prose-invert-headings': 'var(--color-white)',
                        // '--tw-prose-invert-lead': 'var(--color-pink-300)',
                        // '--tw-prose-invert-links': 'var(--color-white)',
                        // '--tw-prose-invert-bold': 'var(--color-white)',
                        // '--tw-prose-invert-counters': 'var(--color-pink-400)',
                        // '--tw-prose-invert-bullets': 'var(--color-pink-600)',
                        // '--tw-prose-invert-hr': 'var(--color-pink-700)',
                        // '--tw-prose-invert-quotes': 'var(--color-pink-100)',
                        // '--tw-prose-invert-quote-borders': 'var(--color-pink-700)',
                        // '--tw-prose-invert-captions': 'var(--color-pink-400)',
                        // '--tw-prose-invert-code': 'var(--color-white)',
                        // '--tw-prose-invert-pre-code': 'var(--color-pink-300)',
                        // '--tw-prose-invert-pre-bg': 'rgb(0 0 0 / 50%)',
                        // '--tw-prose-invert-th-borders': 'var(--color-pink-600)',
                        // '--tw-prose-invert-td-borders': 'var(--color-pink-700)',
                        color: 'var(--vscode-interactive-session-foreground)',
                    },
                },
            },
        },
    },
    plugins: [
        typography,
        plugin(({ addVariant }) => {
            // Allows use to customize styling for VS Code light and dark themes
            addVariant('high-contrast-dark', 'body[data-vscode-theme-kind="vscode-high-contrast"] &')
            addVariant(
                'high-contrast-light',
                'body[data-vscode-theme-kind="vscode-high-contrast-light"] &'
            )
        }),
    ],
}
