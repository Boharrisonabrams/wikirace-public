import { useEffect } from 'react'
import { useLocation } from 'wouter'

/** Legacy route: practice games start directly at /game?type=practice now. */
export default function PracticePage() {
  const [, navigate] = useLocation()

  useEffect(() => {
    navigate('/game?type=practice', { replace: true })
  }, [])

  return null
}
