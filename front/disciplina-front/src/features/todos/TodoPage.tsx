import { useState, useCallback } from 'react'
import { useQuery, useMutation } from 'urql'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Check, Trash2, Pencil, X, Calendar, Bot, ChevronDown, ChevronUp } from 'lucide-react'
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
  if (diff < 0) return { label: `En retard (${Math.abs(diff)}j)`, cls: 'bg-red-100 text-red-700 border border-red-200' }
  if (diff === 0) return { label: "Aujourd'hui", cls: 'bg-orange-100 text-orange-700 border border-orange-200' }
  if (diff <= 3) return { label: `Dans ${diff}j`, cls: 'bg-amber-100 text-amber-700 border border-amber-200' }
  return {
    label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    cls: 'bg-gray-100 text-gray-600 border border-gray-200',
  }
}

function useAccentColor() {
  const role = useAuthStore((s) => s.user?.role)
  if (role === UserRole.RH || role === UserRole.RESPONSABLE) return '#60207E'
  return '#1130A7'
}

const STATUS_CYCLE: Record<TodoStatus, TodoStatus> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'TODO',
}

const STATUS_LABEL: Record<TodoStatus, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  DONE: 'Terminé',
}

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
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ ['--tw-ring-color' as string]: accent + '60' }}
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
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
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

// ── Todo card (sortable) ─────────────────────────────────────────────────────

interface TodoCardProps {
  todo: Todo
  accent: string
  onCycleStatus: () => void
  onEdit: () => void
  onDelete: () => void
}

function TodoCard({ todo, accent, onCycleStatus, onEdit, onDelete }: TodoCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  const deadlineInfo = getDeadlineInfo(todo.deadline)
  const isDone = todo.status === 'DONE'
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md ${
        isDone ? 'opacity-60' : ''
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 cursor-grab text-gray-300 hover:text-gray-500 transition-colors active:cursor-grabbing touch-none"
        tabIndex={-1}
      >
        <GripVertical size={16} />
      </button>

      {/* Status toggle */}
      <button
        onClick={onCycleStatus}
        title={`${STATUS_LABEL[todo.status]} — cliquer pour changer`}
        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110"
        style={{
          borderColor: todo.status === 'DONE' ? accent : todo.status === 'IN_PROGRESS' ? accent + '80' : '#d1d5db',
          backgroundColor: todo.status === 'DONE' ? accent : 'transparent',
        }}
      >
        {todo.status === 'DONE' && <Check size={11} className="text-white" />}
        {todo.status === 'IN_PROGRESS' && (
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span
            className={`text-sm font-medium leading-snug ${
              isDone ? 'line-through text-gray-400' : 'text-gray-800'
            }`}
          >
            {todo.title}
          </span>
          {todo.source === 'SYSTEM' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600 border border-violet-200">
              <Bot size={10} /> Auto
            </span>
          )}
        </div>

        {todo.description && (
          <button
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-1 mt-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Masquer' : 'Voir le détail'}
          </button>
        )}
        {expanded && todo.description && (
          <p className="mt-1 text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">{todo.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5 mt-2">
          {deadlineInfo && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${deadlineInfo.cls}`}>
              <Calendar size={10} />
              {deadlineInfo.label}
            </span>
          )}
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border"
            style={{
              color: todo.status === 'TODO' ? '#6b7280' : accent,
              borderColor: todo.status === 'TODO' ? '#e5e7eb' : accent + '40',
              backgroundColor: todo.status === 'TODO' ? 'transparent' : accent + '15',
            }}
          >
            {STATUS_LABEL[todo.status]}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
        <button
          onClick={onEdit}
          className="p-1 text-gray-400 hover:text-gray-700 transition-colors rounded"
          title="Modifier"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded"
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function TodoPage() {
  const accent = useAccentColor()

  const [{ data, fetching, error }, refetch] = useQuery({ query: MY_TODOS_QUERY })
  const [, createTodo] = useMutation(CREATE_TODO_MUTATION)
  const [, updateTodo] = useMutation(UPDATE_TODO_MUTATION)
  const [, reorderTodos] = useMutation(REORDER_TODOS_MUTATION)
  const [, deleteTodo] = useMutation(DELETE_TODO_MUTATION)

  const [showForm, setShowForm] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [localOrder, setLocalOrder] = useState<number[] | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const todos: Todo[] = data?.myTodos ?? []

  const orderedTodos = localOrder
    ? (localOrder.map((id) => todos.find((t) => t.id === id)).filter(Boolean) as Todo[])
    : [...todos].sort((a, b) => {
        if (a.status === 'DONE' && b.status !== 'DONE') return 1
        if (a.status !== 'DONE' && b.status === 'DONE') return -1
        return a.position - b.position
      })

  const activeTodo = activeId != null ? todos.find((t) => t.id === activeId) : null

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as number)
    if (!localOrder) setLocalOrder(orderedTodos.map((t) => t.id))
  }

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      setActiveId(null)
      if (!over || active.id === over.id) return

      const currentOrder = localOrder ?? orderedTodos.map((t) => t.id)
      const oldIndex = currentOrder.indexOf(active.id as number)
      const newIndex = currentOrder.indexOf(over.id as number)
      if (oldIndex === -1 || newIndex === -1) return

      const newOrder = arrayMove(currentOrder, oldIndex, newIndex)
      setLocalOrder(newOrder)
      await reorderTodos({ orderedIds: newOrder })
      setLocalOrder(null)
      refetch({ requestPolicy: 'network-only' })
    },
    [localOrder, orderedTodos, reorderTodos, refetch],
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

  const handleCycleStatus = async (todo: Todo) => {
    await updateTodo({ id: todo.id, input: { status: STATUS_CYCLE[todo.status] } })
    refetch({ requestPolicy: 'network-only' })
  }

  const handleDelete = async (id: number) => {
    await deleteTodo({ id })
    refetch({ requestPolicy: 'network-only' })
  }

  const pending = orderedTodos.filter((t) => t.status !== 'DONE')
  const done = orderedTodos.filter((t) => t.status === 'DONE')

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mes tâches</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pending.length} à faire · {done.length} terminée{done.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: accent }}
        >
          <Plus size={16} />
          Nouvelle tâche
        </button>
      </div>

      {fetching && (
        <div className="text-center py-16 text-gray-400 text-sm">Chargement…</div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          Erreur : {error.message}
        </div>
      )}

      {!fetching && !error && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {orderedTodos.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
                  <p className="text-gray-400 text-sm">Aucune tâche pour le moment</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-3 text-sm font-semibold hover:underline underline-offset-2"
                    style={{ color: accent }}
                  >
                    Créer ma première tâche
                  </button>
                </div>
              )}
              {orderedTodos.map((todo) => (
                <TodoCard
                  key={todo.id}
                  todo={todo}
                  accent={accent}
                  onCycleStatus={() => handleCycleStatus(todo)}
                  onEdit={() => setEditingTodo(todo)}
                  onDelete={() => handleDelete(todo.id)}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeTodo && (
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-2xl opacity-95 rotate-1">
                <span className="text-sm font-medium text-gray-800">{activeTodo.title}</span>
              </div>
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
