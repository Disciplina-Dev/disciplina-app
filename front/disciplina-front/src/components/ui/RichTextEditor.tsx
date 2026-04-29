import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Heading2,
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
}

function ToolbarButton({
  onClick, active, title, children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={[
        'flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors',
        active
          ? 'bg-purple/10 text-purple'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="h-5 w-px bg-gray-200 mx-0.5" />
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Rédigez votre message...',
  minHeight = '200px',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: {}, orderedList: {}, heading: { levels: [2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[inherit] px-4 py-3 text-sm text-gray-900',
      },
    },
  })

  // Sync external value changes (e.g. template applied)
  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, false)
    }
  }, [value])

  if (!editor) return null

  const btn = (label: string, action: () => void, active?: boolean) => (
    <ToolbarButton key={label} onClick={action} active={active} title={label}>
      {label === 'Gras' && <Bold size={14} />}
      {label === 'Italique' && <Italic size={14} />}
      {label === 'Souligné' && <UnderlineIcon size={14} />}
      {label === 'Titre' && <Heading2 size={14} />}
      {label === 'Liste' && <List size={14} />}
      {label === 'Liste numérotée' && <ListOrdered size={14} />}
      {label === 'Gauche' && <AlignLeft size={14} />}
      {label === 'Centre' && <AlignCenter size={14} />}
      {label === 'Droite' && <AlignRight size={14} />}
    </ToolbarButton>
  )

  return (
    <div className="rounded-[10px] border border-gray-100 bg-white focus-within:border-blue transition-colors overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-gray-100 px-2 py-1.5 flex-wrap">
        {btn('Gras', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
        {btn('Italique', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
        {btn('Souligné', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
        <Divider />
        {btn('Titre', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
        {btn('Liste', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {btn('Liste numérotée', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        <Divider />
        {btn('Gauche', () => editor.chain().focus().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' }))}
        {btn('Centre', () => editor.chain().focus().setTextAlign('center').run(), editor.isActive({ textAlign: 'center' }))}
        {btn('Droite', () => editor.chain().focus().setTextAlign('right').run(), editor.isActive({ textAlign: 'right' }))}
      </div>

      {/* Editor */}
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .tiptap p { margin: 0 0 0.5em; }
        .tiptap h2 { font-size: 1.1em; font-weight: 700; margin: 0.75em 0 0.25em; }
        .tiptap h3 { font-size: 1em; font-weight: 600; margin: 0.5em 0 0.25em; }
        .tiptap ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .tiptap ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .tiptap li { margin: 0.15em 0; }
        .tiptap p.is-editor-empty:first-child::before {
          color: #d1d5db;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
