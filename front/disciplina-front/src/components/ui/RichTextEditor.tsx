import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { useEffect, useCallback, useRef, useState } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Heading2, Link2, Unlink, Palette,
} from 'lucide-react'

const COLOR_SWATCHES = [
  { label: 'Noir', value: '#0D0D0D' },
  { label: 'Gris', value: '#3D3D3D' },
  { label: 'Bleu', value: '#1130A7' },
  { label: 'Violet', value: '#60207E' },
  { label: 'Rose', value: '#B10F55' },
  { label: 'Succès', value: '#1A7A4A' },
  { label: 'Alerte', value: '#A65C00' },
]

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
  const [colorPanelOpen, setColorPanelOpen] = useState(false)
  const colorPanelRef = useRef<HTMLDivElement>(null)

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
      TextStyle,
      Color,
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

  useEffect(() => {
    if (!colorPanelOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!colorPanelRef.current?.contains(e.target as Node)) setColorPanelOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setColorPanelOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [colorPanelOpen])

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
        <div className="relative" ref={colorPanelRef}>
          <ToolbarButton
            onClick={() => setColorPanelOpen((open) => !open)}
            active={colorPanelOpen || editor.isActive('textStyle')}
            title="Couleur du texte"
          >
            <Palette size={14} />
          </ToolbarButton>
          {colorPanelOpen && (
            <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-md border border-gray-100 bg-white p-1.5 shadow-md">
              {COLOR_SWATCHES.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    editor.chain().focus().setColor(value).run()
                    setColorPanelOpen(false)
                  }}
                  className="h-5 w-5 rounded-full ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: value }}
                />
              ))}
              <label
                title="Autre couleur..."
                className="h-5 w-5 cursor-pointer overflow-hidden rounded-full border-0 p-0 ring-1 ring-inset ring-black/10"
                style={{
                  background:
                    'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                }}
              >
                <input
                  type="color"
                  className="h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                  onBlur={() => setColorPanelOpen(false)}
                />
              </label>
              <button
                type="button"
                title="Réinitialiser la couleur"
                onMouseDown={(e) => {
                  e.preventDefault()
                  editor.chain().focus().unsetColor().run()
                  setColorPanelOpen(false)
                }}
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-gray-500 ring-1 ring-inset ring-black/10"
              >
                ×
              </button>
            </div>
          )}
        </div>
        <Divider />
        {btn('Titre', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
        {btn('Liste', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {btn('Liste numérotée', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        <Divider />
        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Insérer un lien">
          <Link2 size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
          title="Retirer le lien"
        >
          <Unlink size={14} />
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
