import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation } from 'urql'
import { IconChevronDown, IconClose, IconFolder, IconPlus, IconSearch } from '@/components/ui/icons'
import type { TodoGroup } from './types'
import {
  MY_TODO_GROUPS_QUERY,
  TODO_GROUPS_FOR_USER_QUERY,
  CREATE_TODO_GROUP_MUTATION,
} from './todoOperations'

interface GroupSelectorProps {
  value: number | null
  onChange: (groupId: number | null) => void
  forUserId: number | null
  accent?: string
  disabled?: boolean
}

export default function GroupSelector({ value, onChange, forUserId, accent = '#1130A7', disabled }: GroupSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const isForOtherUser = forUserId != null

  const groupsQuery = isForOtherUser
    ? TODO_GROUPS_FOR_USER_QUERY
    : MY_TODO_GROUPS_QUERY

  const queryVariables = isForOtherUser ? { userId: forUserId } : undefined

  const [{ data, fetching }, refetch] = useQuery({
    query: groupsQuery,
    variables: queryVariables as any,
    requestPolicy: 'cache-and-network',
  })

  const groups: TodoGroup[] = useMemo(() => {
    if (isForOtherUser) return (data?.todoGroupsForUser as TodoGroup[]) ?? []
    return (data?.myTodoGroups as TodoGroup[]) ?? []
  }, [data, isForOtherUser])

  const [, createGroup] = useMutation(CREATE_TODO_GROUP_MUTATION)

  const selectedGroup = groups.find((g) => g.id === value) ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((g) => g.name.toLowerCase().includes(q))
  }, [groups, search])

  const exactMatch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return false
    return groups.some((g) => g.name.toLowerCase() === q)
  }, [groups, search])

  const canCreate = search.trim().length > 0 && !exactMatch && search.trim().length <= 100

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Reset search when opening or when forUserId changes
  useEffect(() => {
    if (open) setSearch('')
  }, [open, forUserId])

  const handleCreate = async () => {
    const name = search.trim()
    if (!name) return
    const result = await createGroup({
      name,
      forUserId: forUserId ?? null,
    })
    if (result.error) return
    const created = result.data?.createTodoGroup as TodoGroup | undefined
    // Refetch to get updated list (also handles case where group already existed)
    await refetch({ requestPolicy: 'network-only' } as any)
    if (created?.id) {
      onChange(created.id)
    } else {
      // Fallback: find by name if mutation returned existing
      const found = groups.find((g) => g.name.toLowerCase() === name.toLowerCase())
      if (found) onChange(found.id)
    }
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-lg border border-[var(--ds-border)] px-3 py-2 text-sm text-[var(--ds-text)] bg-[var(--ds-surface)] focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2 truncate">
          <IconFolder width={12} height={12} className="text-[var(--ds-text-subtle)] flex-shrink-0" />
          <span className="truncate">{selectedGroup ? selectedGroup.name : 'Sans groupe'}</span>
        </span>
        <span className="flex items-center gap-1 flex-shrink-0 ml-2">
          {value != null && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  onChange(null)
                }
              }}
              className="p-0.5 rounded hover:bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)] hover:text-[var(--ds-text-muted)]"
              title="Retirer le groupe"
            >
              <IconClose width={12} height={12} />
            </span>
          )}
          <IconChevronDown width={14} height={14} className={`text-[var(--ds-text-subtle)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-[var(--ds-surface)] rounded-xl shadow-lg border border-[var(--ds-border)] overflow-hidden">
          {/* Search bar + + button */}
          <div className="flex items-center gap-1 p-2 border-b border-[var(--ds-border)]">
            <div className="relative flex-1">
              <IconSearch width={12} height={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--ds-text-subtle)]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-[var(--ds-border)] focus:outline-none focus:ring-1 placeholder-gray-400"
                style={{}}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canCreate) {
                    e.preventDefault()
                    handleCreate()
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex-shrink-0"
              style={{ backgroundColor: accent }}
              title={canCreate ? `Créer "${search.trim()}"` : 'Saisissez un nouveau nom'}
            >
              <IconPlus width={16} height={16} />
            </button>
          </div>

          {/* List */}
          <div className="max-h-48 overflow-auto py-1">
            {fetching && groups.length === 0 && (
              <div className="px-3 py-2 text-xs text-[var(--ds-text-subtle)]">Chargement...</div>
            )}

            {/* Ungrouped option */}
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--ds-surface-sunken)] flex items-center gap-2 ${value == null ? 'bg-[var(--ds-surface-sunken)] font-semibold' : 'text-[var(--ds-text-muted)]'}`}
            >
              <span className="w-2 h-2 rounded-full bg-[var(--ds-border-strong)] flex-shrink-0" />
              Sans groupe
            </button>

            {filtered.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  onChange(g.id)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--ds-surface-sunken)] flex items-center gap-2 truncate ${value === g.id ? 'bg-[var(--ds-surface-sunken)] font-semibold text-[var(--ds-text)]' : 'text-[var(--ds-text-muted)]'}`}
              >
                <IconFolder width={12} height={12} className="text-[var(--ds-text-subtle)] flex-shrink-0" />
                <span className="truncate">{g.name}</span>
              </button>
            ))}

            {filtered.length === 0 && !fetching && (
              <div className="px-3 py-3 text-xs text-[var(--ds-text-subtle)] text-center">
                Aucun groupe
                {canCreate && <div className="mt-1">Appuyez sur + pour créer "{search.trim()}"</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
