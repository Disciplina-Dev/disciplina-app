import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation } from 'urql'
import { Search, Plus, Folder, X, ChevronDown } from 'lucide-react'
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
        className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2 truncate">
          <Folder size={12} className="text-gray-400 flex-shrink-0" />
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
              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              title="Retirer le groupe"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Search bar + + button */}
          <div className="flex items-center gap-1 p-2 border-b border-gray-100">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-1 placeholder-gray-400"
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
              <Plus size={16} />
            </button>
          </div>

          {/* List */}
          <div className="max-h-48 overflow-auto py-1">
            {fetching && groups.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">Chargement...</div>
            )}

            {/* Ungrouped option */}
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${value == null ? 'bg-gray-50 font-semibold' : 'text-gray-700'}`}
            >
              <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
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
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2 truncate ${value === g.id ? 'bg-gray-50 font-semibold text-gray-900' : 'text-gray-700'}`}
              >
                <Folder size={12} className="text-gray-400 flex-shrink-0" />
                <span className="truncate">{g.name}</span>
              </button>
            ))}

            {filtered.length === 0 && !fetching && (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">
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
