import * as React from 'react'

const MOBILE_BREAKPOINT = 768

/**
 * Small utility hook used by the shadcn sidebar component to decide when to
 * switch from desktop rail behavior to mobile sheet behavior.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    mediaQuery.addEventListener('change', onChange)
    onChange()
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  return Boolean(isMobile)
}
