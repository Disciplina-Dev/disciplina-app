import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { useEffect, useCallback } from 'react'
import { IconAlignCenter, IconAlignLeft, IconAlignRight, IconBold, IconHeading, IconItalic, IconLink, IconList, IconListOrdered, IconUnderline, IconUnlink } from '@/components/ui/icons'

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
          : 'text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="h-5 w-px bg-[var(--ds-surface-sunken)] mx-0.5" />
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
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[inherit] px-4 py-3 text-sm text-[var(--ds-text)]',
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

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const input = window.prompt('Adresse du lien (URL)', prev ?? 'https://')
    if (input === null) return // annulé
    const url = input.trim()
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    // Préfixe https:// si l'utilisateur n'a pas mis de schéma.
    const href = /^(https?:\/\/|mailto:|tel:)/i.test(url) ? url : `https://${url}`
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }, [editor])

  if (!editor) return null

  const btn = (label: string, action: () => void, active?: boolean) => (
    <ToolbarButton key={label} onClick={action} active={active} title={label}>
      {label === 'Gras' && <IconBold width={14} height={14} />}
      {label === 'Italique' && <IconItalic width={14} height={14} />}
      {label === 'Souligné' && <IconUnderline width={14} height={14} />}
      {label === 'Titre' && <IconHeading width={14} height={14} />}
      {label === 'Liste' && <IconList width={14} height={14} />}
      {label === 'Liste numérotée' && <IconListOrdered width={14} height={14} />}
      {label === 'Gauche' && <IconAlignLeft width={14} height={14} />}
      {label === 'Centre' && <IconAlignCenter width={14} height={14} />}
      {label === 'Droite' && <IconAlignRight width={14} height={14} />}
    </ToolbarButton>
  )

  return (
    <div className="rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] focus-within:border-blue transition-colors overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-[var(--ds-border)] px-2 py-1.5 flex-wrap">
        {btn('Gras', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
        {btn('Italique', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
        {btn('Souligné', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
        <Divider />
        {btn('Titre', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
        {btn('Liste', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {btn('Liste numérotée', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        <Divider />
        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Insérer un lien">
          <IconLink width={14} height={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
          title="Retirer le lien"
        >
          <IconUnlink width={14} height={14} />
        </ToolbarButton>
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
        .tiptap a { color: #2563eb; text-decoration: underline; cursor: pointer; }
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
