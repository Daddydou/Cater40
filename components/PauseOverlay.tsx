'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function PauseOverlay() {
  const [paused, setPaused] = useState(false)
  const initialized = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchPause = async () => {
    const { data } = await supabase
      .from('app_state')
      .select('pause_globale')
      .eq('id', 1)
      .maybeSingle()
    if (data !== null) setPaused(data.pause_globale)
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    fetchPause()
    intervalRef.current = setInterval(fetchPause, 2000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  if (!paused) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm pointer-events-auto">
      <div className="text-7xl mb-5">🍷</div>
      <p className="text-white text-3xl font-black mb-2">Petite pause</p>
      <p className="text-white/60 text-lg">Ça reprend dans un instant…</p>
    </div>
  )
}
