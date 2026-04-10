export default defineAppConfig({
  ui: {
    colors: {
      primary: 'orange',
      neutral: 'zinc',
    },
    button: {
      defaultVariants: {
        color: 'primary',
      },
    },
    badge: {
      defaultVariants: {
        variant: 'subtle',
      },
    },
    card: {
      slots: {
        root: 'shadow-none',
      },
    },
  },
})
