/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      /**
       * Typography Scale
       *
       * Defines semantic font sizes and line heights used throughout the app.
       * This centralized system ensures consistent visual hierarchy and makes
       * global typography changes straightforward.
       *
       * Usage: Apply these semantic classes (text-body, text-label, etc.) instead
       * of raw size utilities (text-sm, text-base) to maintain consistency.
       *
       * Scale:
       * - display: 2.25rem/2.75rem (36px/44px) - Hero text, empty states, onboarding
       * - title: 1.5rem/2rem (24px/32px) - Page headers, section titles
       * - subtitle: 1.25rem/1.75rem (20px/28px) - Secondary headings, emphasized text
       * - body: 1rem/1.5rem (16px/24px) - Default readable text, prose, messages
       * - label: 0.9375rem/1.4rem (15px/22.4px) - Buttons, navigation, form labels
       * - meta: 0.8125rem/1.25rem (13px/20px) - Captions, badges, helper text
       */
      fontSize: {
        display: ['2.25rem', { lineHeight: '2.75rem' }],
        title: ['1.5rem', { lineHeight: '2rem' }],
        subtitle: ['1.25rem', { lineHeight: '1.75rem' }],
        body: ['1rem', { lineHeight: '1.5rem' }],
        label: ['0.9375rem', { lineHeight: '1.4rem' }],
        meta: ['0.8125rem', { lineHeight: '1.25rem' }],
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': 'var(--foreground)',
            '--tw-prose-headings': 'var(--foreground)',
            '--tw-prose-lead': 'var(--muted-foreground)',
            '--tw-prose-links': 'var(--primary)',
            '--tw-prose-bold': 'var(--foreground)',
            '--tw-prose-counters': 'var(--muted-foreground)',
            '--tw-prose-bullets': 'var(--muted-foreground)',
            '--tw-prose-hr': 'var(--border)',
            '--tw-prose-quotes': 'var(--muted-foreground)',
            '--tw-prose-quote-borders': 'var(--border)',
            '--tw-prose-captions': 'var(--muted-foreground)',
            '--tw-prose-code': 'var(--foreground)',
            '--tw-prose-pre-code': 'var(--foreground)',
            '--tw-prose-pre-bg': 'var(--muted)',
            '--tw-prose-th-borders': 'var(--border)',
            '--tw-prose-td-borders': 'var(--border)',
            maxWidth: 'none',
            /**
             * Prose typography uses body size (16px/24px) for comfortable reading.
             * Previously set to 0.875rem (14px) to match UI chrome, but readable
             * content benefits from slightly larger text. Markdown content, assistant
             * responses, and long-form text all use these prose defaults.
             *
             * Note: Individual components can override with prose-sm/prose-lg if needed.
             */
            fontSize: '1rem',
            lineHeight: '1.5',
            code: {
              fontSize: '0.9375rem', // 15px to visually match body text (16px) in monospace
              lineHeight: '1.5rem',
              backgroundColor: 'var(--muted)',
              paddingLeft: '0.25rem',
              paddingRight: '0.25rem',
              paddingTop: '0.125rem',
              paddingBottom: '0.125rem',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            'pre code': {
              backgroundColor: 'transparent',
              padding: '0',
            },
          },
        },
      },
    },
  },
}
