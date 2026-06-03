'use client'
import { useMemo } from 'react'

type Props = {
  name: string
  avatarUrl?: string | null
  size?: number
}

const COLORS = ['#E57373','#F06292','#BA68C8','#7986CB','#4FC3F7','#4DB6AC','#81C784','#FFD54F','#FF8A65']

export default function PlayerAvatar({ name, avatarUrl, size = 40 }: Props) {
  const initiale = name?.charAt(0)?.toUpperCase() ?? '?'
  const colorIndex = useMemo(() => name.charCodeAt(0) % COLORS.length, [name])
  const bg = COLORS[colorIndex]

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full object-cover flex-shrink-0 border-2 border-white/20"
      />
    )
  }

  return (
    <div
      style={{ width: size, height: size, backgroundColor: bg }}
      className="rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white/20 font-bold text-white"
    >
      <span style={{ fontSize: size * 0.4 }}>{initiale}</span>
    </div>
  )
}
