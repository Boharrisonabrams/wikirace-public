import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { Trophy, ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import ExpandableFinisherRow from '@/components/ExpandableFinisherRow'
import { useAuth } from '@/hooks/use-auth'
import { formatTime, puzzleNumber } from '@/lib/game-utils'

interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  clicks: number
  time_seconds: number
  completed_at: string
  path?: string[]
}

interface DailyChallenge {
  id: string
  date: string
  startTitle: string
  endTitle: string
}

export default function LeaderboardPage() {
  const [, navigate] = useLocation()
  const { user } = useAuth()
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [tab, setTab] = useState<'all' | 'friends'>('all')
  const [loading, setLoading] = useState(true)
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)

  useEffect(() => {
    api<{ challenge: DailyChallenge }>('/daily')
      .then((data) => setChallenge(data.challenge))
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!challenge) return
    setLoading(true)
    setExpandedRowKey(null)
    api<{ leaderboard: LeaderboardEntry[] }>(
      `/leaderboard/daily?challengeId=${challenge.id}${tab === 'friends' ? '&friendsOnly=true' : ''}`,
    )
      .then((data) => setEntries(data.leaderboard))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [challenge, tab])

  return (
    <div className="min-h-screen bg-[var(--wiki-chrome)]">
      <header className="border-b border-[var(--wiki-rule)] bg-white">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/')}
            aria-label="Back to home"
            className="flex h-10 w-10 items-center justify-center rounded border border-[var(--wiki-hairline)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-serif text-xl font-semibold leading-tight">Leaderboard</h1>
            {challenge && (
              <p className="text-xs text-muted-foreground">
                No. {puzzleNumber(challenge.date)} · {challenge.startTitle} → {challenge.endTitle}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5">
        <div className="mb-4 grid grid-cols-2 border border-[var(--wiki-rule)] bg-white text-sm font-medium">
          <button
            onClick={() => setTab('all')}
            className={`min-h-11 px-3 py-2 ${tab === 'all' ? 'bg-primary text-primary-foreground' : ''}`}
          >
            Everyone
          </button>
          <button
            onClick={() => setTab('friends')}
            className={`min-h-11 border-l border-[var(--wiki-rule)] px-3 py-2 ${tab === 'friends' ? 'bg-primary text-primary-foreground' : ''}`}
          >
            Friends
          </button>
        </div>

        <div className="border border-[var(--wiki-rule)] bg-white">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-[var(--wiki-soft)]" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <Trophy className="mx-auto mb-3 h-10 w-10 text-[var(--wiki-soft)]" />
              {tab === 'friends' ? (
                <>
                  <p>No friend has finished today's race.</p>
                  <button
                    onClick={() => navigate('/profile')}
                    className="mt-2 text-[var(--wiki-blue)] underline underline-offset-2"
                  >
                    Add friends with a friend code
                  </button>
                </>
              ) : (
                <p>No one has finished yet. Be first — and set the score to beat.</p>
              )}
            </div>
          ) : (
            <ol>
              {entries.map((entry) => {
                const isMe = user?.id === entry.user_id
                const rowKey = `${entry.user_id}-${entry.completed_at}-${entry.rank}`
                return (
                  <ExpandableFinisherRow
                    key={rowKey}
                    expanded={expandedRowKey === rowKey}
                    onToggle={() =>
                      setExpandedRowKey((current) => (current === rowKey ? null : rowKey))
                    }
                    path={entry.path}
                  >
                    <div className={`flex items-center gap-3 ${isMe ? 'bg-[var(--wiki-chrome)]' : ''}`}>
                      <span
                        className={`tabular w-8 shrink-0 text-center font-serif text-lg font-semibold ${entry.rank <= 3 ? 'text-[var(--wiki-gold)]' : 'text-muted-foreground'}`}
                      >
                        {entry.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {entry.display_name || entry.username}
                          {isMe && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          @{entry.username}
                          {entry.path?.length ? ' · Tap to reveal path' : ''}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="tabular text-sm font-semibold">
                          {entry.clicks} {entry.clicks === 1 ? 'click' : 'clicks'}
                        </div>
                        <div className="tabular text-xs text-muted-foreground">
                          {formatTime(entry.time_seconds)}
                        </div>
                      </div>
                    </div>
                  </ExpandableFinisherRow>
                )
              })}
            </ol>
          )}
        </div>
      </main>
    </div>
  )
}
