/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-gradient-start': 'var(--primary-gradient-start)',
        'primary-gradient-end': 'var(--primary-gradient-end)',
        'text-dark': 'var(--text-dark)',
        'text-medium': 'var(--text-medium)',
        'text-light': 'var(--text-light)',
        'bg-light': 'var(--bg-light)',
        'bg-white': 'var(--bg-white)',
        'border-light': 'var(--border-light)',
        'border-medium': 'var(--border-medium)',
        'border-dark': 'var(--border-dark)',
        'button-primary': 'var(--button-primary)',
        'button-success': 'var(--button-success)',
        'button-danger': 'var(--button-danger)',
        'button-secondary': 'var(--button-secondary)',
      },
      spacing: {
        'xs': 'var(--spacing-xs)',
        'sm': 'var(--spacing-sm)',
        'md': 'var(--spacing-md)',
        'lg': 'var(--spacing-lg)',
        'xl': 'var(--spacing-xl)',
        'xxl': 'var(--spacing-xxl)',
      },
      fontSize: {
        'sm': 'var(--font-size-sm)',
        'md': 'var(--font-size-md)',
        'lg': 'var(--font-size-lg)',
        'xl': 'var(--font-size-xl)',
        'h1': 'var(--font-size-h1)',
        'h2': 'var(--font-size-h2)',
        'h3': 'var(--font-size-h3)',
        'h4': 'var(--font-size-h4)',
      },
    },
  },
  plugins: [],
}
