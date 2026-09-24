import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** 1024px ve üstü masaüstü yerleşimi. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
