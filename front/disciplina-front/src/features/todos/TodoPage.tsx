import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from 'urql'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, GripVertical, Check, Trash2, Pencil, X, Calendar, Bot,
  ChevronDown, ChevronUp, Circle, Clock, CheckCircle2,
} from 'lucide-react'
import { useAuthStore, UserRole } from '@/store/authStore'
import type { Todo, TodoStatus } from './types'
import {
  MY_TODOS_QUERY,
  CREATE_TODO_MUTATION,
  UPDATE_TODO_MUTATION,
  REORDER_TODOS_MUTATION,
  DELETE_TODO_MUTATION,
} from './todoOperations'

// ── helpers ─────────────────────────────────────────────────────────────────

function getDeadlineInfo(deadline: string | null): { label: string; cls: string } | null {
  if (!deadline) return null
  const d = new Date(deadline)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000)
  if (diff < 0) return { label: `Retard ${Math.abs(diff)}j`, cls: 'bg-red-100 text-red-700 border border-red-200' }
  if (diff === 0) return { label: "Aujourd'hui", cls: 'bg-orange-100 text-orange-700 border border-orange-200' }
  if (diff <= 3) return { label: `Dans ${diff}j`, cls: 'bg-amber-100 text-amber-700 border border-amber-200' }
  return {
    label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    cls: 'bg-gray-100 text-gray-600 border border-gray-200',
  }
}

function useAccentColor() {
  const role = useAuthStore((s) => s.user?.role)
  return role === UserRole.RH || role === UserRole.RESPONSABLE ? '#60207E' : '#1130A7'
}

const COLUMNS: { status: TodoStatus; label: string; icon: React.ReactNode; bg: string }[] = [
  { status: 'TODO',        label: 'À faire',  icon: <Circle size={14} />,       bg: 'bg-gray-50' },
  { status: 'IN_PROGRESS', label: 'En cours', icon: <Clock size={14} />,        bg: 'bg-blue-50/50' },
  { status: 'DONE',        label: 'Terminé',  icon: <CheckCircle2 size={14} />, bg: 'bg-green-50/50' },
]

// ── Form modal ───────────────────────────────────────────────────────────────

interface FormModalProps {
  initial?: Pick<Todo, 'title' | 'description' | 'deadline'>
  accent: string
  onSubmit: (title: string, description: string, deadline: string) => void
  onClose: () => void
}

function FormModal({ initial, accent, onSubmit, onClose }: FormModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit(title.trim(), description.trim(), deadline)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {initial ? 'Modifier la tâche' : 'Nouvelle tâche'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Titre *</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nom de la tâche…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails optionnels…"
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              <span className="flex items-center gap-1"><Calendar size={12} /> Échéance</span>
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Annuler
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-opacity disabled:opacity-40 hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              {initial ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Todo card ────────────────────────────────────────────────────────────────

interface TodoCardProps {
  todo: Todo
  accent: string
  onEdit: () => void
  onDelete: () => void
  overlay?: boolean
}

function TodoCard({ todo, accent, onEdit, onDelete, overlay = false }: TodoCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  const deadlineInfo = getDeadlineInfo(todo.deadline)
  const [expanded, setExpanded] = useState(false)

  const card = (
    <div
      className={`group bg-white rounded-xl border border-gray-100 shadow-sm p-3 transition-shadow ${
        overlay ? 'shadow-2xl rotate-1 scale-105' : 'hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          {...(overlay ? {} : { ...attributes, ...listeners })}
          className="mt-0.5 cursor-grab text-gray-300 hover:text-gray-500 transition-colors active:cursor-grabbing touch-none flex-shrink-0"
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5 flex-wrap">
            <span className={`text-sm font-medium leading-snug ${todo.status === 'DONE' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {todo.title}
            </span>
            {todo.source === 'SYSTEM' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600 border border-violet-200 flex-shrink-0">
                <Bot size={9} /> Auto
              </span>
            )}
          </div>

          {todo.description && (
            <button
              onClick={() => setExpanded((p) => !p)}
              className="flex items-center gap-1 mt-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {expanded ? 'Masquer' : 'Détail'}
            </button>
          )}
          {expanded && todo.description && (
            <p className="mt-1 text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">{todo.description}</p>
          )}

          {deadlineInfo && (
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${deadlineInfo.cls}`}>
                <Calendar size={9} />
                {deadlineInfo.label}
              </span>
            </div>
          )}
        </div>

        {!overlay && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={onEdit} className="p-1 text-gray-400 hover:text-gray-700 transition-colors rounded" title="Modifier">
              <Pencil size={13} />
            </button>
            <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded" title="Supprimer">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )

  if (overlay) return card
  return (
    <div ref={setNodeRef} style={style}>
      {card}
    </div>
  )
}

// ── Kanban column ─────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: TodoStatus
  label: string
  icon: React.ReactNode
  bg: string
  accent: string
  todos: Todo[]
  onEdit: (t: Todo) => void
  onDelete: (id: number) => void
  onAddInColumn: (status: TodoStatus) => void
}

function KanbanColumn({ status, label, icon, bg, accent, todos, onEdit, onDelete, onAddInColumn }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status })

  const columnAccent =
    status === 'DONE' ? '#10b981' :
    status === 'IN_PROGRESS' ? '#f59e0b' :
    accent

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span style={{ color: columnAccent }}>{icon}</span>
          <span className="text-sm font-bold text-gray-700">{label}</span>
          <span
            className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: columnAccent }}
          >
            {todos.length}
          </span>
        </div>
        <button
          onClick={() => onAddInColumn(status)}
          className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Ajouter dans cette colonne"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl ${bg} border border-gray-100 p-2 min-h-[200px]`}
      >
        <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {todos.map((todo) => (
              <TodoCard
                key={todo.id}
                todo={todo}
                accent={accent}
                onEdit={() => onEdit(todo)}
                onDelete={() => onDelete(todo.id)}
              />
            ))}
            {todos.length === 0 && (
              <div className="flex items-center justify-center h-20 text-xs text-gray-400">
                Glisser ici
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function TodoPage() {
  const accent = useAccentColor()

  const [{ data, fetching, error }, refetch] = useQuery({ query: MY_TODOS_QUERY })
  const [, updateTodo] = useMutation(UPDATE_TODO_MUTATION)
  const [, createTodo] = useMutation(CREATE_TODO_MUTATION)
  const [, reorderTodos] = useMutation(REORDER_TODOS_MUTATION)
  const [, deleteTodo] = useMutation(DELETE_TODO_MUTATION)

  const [showForm, setShowForm] = useState(false)
  const [defaultStatus, setDefaultStatus] = useState<TodoStatus>('TODO')
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [originalCol, setOriginalCol] = useState<TodoStatus | null>(null)

  // Local column order: { TODO: [id,...], IN_PROGRESS: [...], DONE: [...] }
  const [colOrder, setColOrder] = useState<Record<TodoStatus, number[]>>({ TODO: [], IN_PROGRESS: [], DONE: [] })

  const todos: Todo[] = data?.myTodos ?? []
  const todoMap = Object.fromEntries(todos.map((t) => [t.id, t])) as Record<number, Todo>

  // Sync colOrder from server data
  useEffect(() => {
    const groups: Record<TodoStatus, number[]> = { TODO: [], IN_PROGRESS: [], DONE: [] }
    ;[...todos]
      .sort((a, b) => a.position - b.position)
      .forEach((t) => groups[t.status].push(t.id))
    setColOrder(groups)
  }, [data])

  const activeTodo = activeId != null ? todoMap[activeId] : null

  function findContainer(id: number): TodoStatus | null {
    for (const status of ['TODO', 'IN_PROGRESS', 'DONE'] as TodoStatus[]) {
      if (colOrder[status].includes(id)) return status
    }
    return null
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragStart = ({ active }: DragStartEvent) => {
    const id = active.id as number
    setActiveId(id)
    setOriginalCol(findContainer(id))
  }

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const activeId = active.id as number
    const overId = over.id

    const activeCol = findContainer(activeId)
    // overId can be a TodoStatus string (column droppable) or a todo id (number)
    const overCol = typeof overId === 'string'
      ? (overId as TodoStatus)
      : findContainer(overId as number)

    if (!activeCol || !overCol || activeCol === overCol) return

    // Move to new column (optimistic)
    setColOrder((prev) => {
      const fromIds = prev[activeCol].filter((id) => id !== activeId)
      const toIds = typeof overId === 'string'
        ? [...prev[overCol], activeId]
        : (() => {
            const overIndex = prev[overCol].indexOf(overId as number)
            const result = [...prev[overCol]]
            result.splice(overIndex, 0, activeId)
            return result
          })()
      return { ...prev, [activeCol]: fromIds, [overCol]: toIds }
    })
  }

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      setActiveId(null)
      if (!over) return

      const activeId = active.id as number
      const overId = over.id

      // Use originalCol (captured at dragStart, before optimistic moves)
      const startCol = originalCol
      const currentCol = findContainer(activeId) // after optimistic moves
      const overCol = typeof overId === 'string'
        ? (overId as TodoStatus)
        : findContainer(overId as number)

      if (!startCol || !currentCol || !overCol) return

      if (startCol !== currentCol) {
        // Status changed — currentCol is the destination after optimistic dragOver
        await updateTodo({ id: activeId, input: { status: currentCol } })
      } else if (typeof overId === 'number' && activeId !== overId) {
        // Reordered within same column
        setColOrder((prev) => {
          const ids = prev[currentCol]
          const oldIdx = ids.indexOf(activeId)
          const newIdx = ids.indexOf(overId)
          if (oldIdx === -1 || newIdx === -1) return prev
          return { ...prev, [currentCol]: arrayMove(ids, oldIdx, newIdx) }
        })
        // Persist new order for entire user todo list
        const allIds = [
          ...colOrder['TODO'],
          ...colOrder['IN_PROGRESS'],
          ...colOrder['DONE'],
        ].filter((id) => id !== activeId)
        const overIdx = allIds.indexOf(overId)
        allIds.splice(overIdx, 0, activeId)
        await reorderTodos({ orderedIds: allIds })
      }

      refetch({ requestPolicy: 'network-only' })
    },
    [colOrder, originalCol, todoMap, updateTodo, reorderTodos, refetch],
  )

  const handleCreate = async (title: string, description: string, deadline: string) => {
    await createTodo({ input: { title, description: description || null, deadline: deadline || null } })
    setShowForm(false)
    refetch({ requestPolicy: 'network-only' })
  }

  const handleEdit = async (title: string, description: string, deadline: string) => {
    if (!editingTodo) return
    await updateTodo({ id: editingTodo.id, input: { title, description: description || null, deadline: deadline || null } })
    setEditingTodo(null)
    refetch({ requestPolicy: 'network-only' })
  }

  const handleDelete = async (id: number) => {
    await deleteTodo({ id })
    refetch({ requestPolicy: 'network-only' })
  }

  const totalCount = todos.length

  return (
    <div className="flex flex-col h-full px-6 py-6 gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mes tâches</h1>
          <p className="text-sm text-gray-500 mt-0.5">{totalCount} tâche{totalCount > 1 ? 's' : ''} au total</p>
        </div>
        <button
          onClick={() => { setDefaultStatus('TODO'); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: accent }}
        >
          <Plus size={16} />
          Nouvelle tâche
        </button>
      </div>

      {fetching && <div className="text-center py-16 text-gray-400 text-sm">Chargement…</div>}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          Erreur : {error.message}
        </div>
      )}

      {!fetching && !error && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 flex-1 min-h-0 overflow-x-auto">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                {...col}
                accent={accent}
                todos={colOrder[col.status].map((id) => todoMap[id]).filter(Boolean)}
                onEdit={setEditingTodo}
                onDelete={handleDelete}
                onAddInColumn={(status) => { setDefaultStatus(status); setShowForm(true) }}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTodo && (
              <TodoCard
                todo={activeTodo}
                accent={accent}
                onEdit={() => {}}
                onDelete={() => {}}
                overlay
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {showForm && (
        <FormModal accent={accent} onSubmit={handleCreate} onClose={() => setShowForm(false)} />
      )}
      {editingTodo && (
        <FormModal
          accent={accent}
          initial={editingTodo}
          onSubmit={handleEdit}
          onClose={() => setEditingTodo(null)}
        />
      )}
    </div>
  )
}
