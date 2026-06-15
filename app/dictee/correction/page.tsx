'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CorrectionRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dictee/animateur')
  }, [router])
  return null
}
