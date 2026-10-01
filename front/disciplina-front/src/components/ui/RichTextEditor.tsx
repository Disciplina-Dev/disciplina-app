import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Image from '@tiptap/extension-image'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import { useEffect, useCallback, useRef, useState } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Heading2, Link2, Unlink, Palette, ImagePlus, MousePointerClick, ALargeSmall, Highlighter, Minus,
} from 'lucide-react'


const MAX_IMAGE_BYTES = 2 * 1024 * 1024


const CTA_BUTTON_STYLE =
  'display:inline-block;background-color:#1130A7;color:#ffffff;padding:10px 20px;' +
  'border-radius:6px;font-weight:600;text-decoration:none'

const LinkWithStyle = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: { default: null },
    }
  },
})

// Pleine largeur par défaut : sans ça une image insérée à sa taille native déborde du
// cadre 600px du mail à l'envoi (aucune CSS de l'éditeur ne voyage avec le HTML envoyé).
const IMAGE_FULL_WIDTH_STYLE = 'width:100%;height:auto;display:block;'

const ImageWithStyle = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: { default: null },
    }
  },
})

type HrAlign = 'left' | 'center' | 'right'

const HR_DEFAULT_STYLE = { color: '#D1D5DB', thicknessPx: 1, widthPct: 100, align: 'left' as HrAlign }

function hrAlignMargins(align: HrAlign): string {
  // Un seul côté à `auto` suffit (l'autre reste au défaut 0) : le sanitizer backend
  // n'autorise que `auto` ou une longueur pour margin-left/right, jamais `0` seul.
  if (align === 'center') return 'margin-left:auto;margin-right:auto;'
  if (align === 'right') return 'margin-left:auto;'
  return 'margin-right:auto;'
}

function buildHrStyle({ color, thicknessPx, widthPct, align }: typeof HR_DEFAULT_STYLE): string {
  return `background-color:${color};height:${thicknessPx}px;width:${widthPct}%;border:none;display:block;${hrAlignMargins(align)}`
}

// De nombreux clients mail (Gmail en tête) suppriment `margin` en CSS inline sur un <hr>,
// même autorisé côté sanitizer — le CSS seul ne suffit donc pas à aligner la barre. L'attribut
// HTML `align` (obsolète en CSS mais toujours supporté nativement par `<hr>`) sert de filet :
// il survit à ce nettoyage là où `margin-left/right:auto` peut être silencieusement ignoré.
function parseHrSettings(attrs: { style?: string | null; align?: string | null }): typeof HR_DEFAULT_STYLE {
  const style = attrs.style
  const color = (style && /background-color:\s*([^;]+)/.exec(style)?.[1]?.trim()) || HR_DEFAULT_STYLE.color
  const thicknessPx = (style && Number(/height:\s*(\d+)px/.exec(style)?.[1])) || HR_DEFAULT_STYLE.thicknessPx
  const widthPct = (style && Number(/width:\s*(\d+)%/.exec(style)?.[1])) || HR_DEFAULT_STYLE.widthPct
  const align: HrAlign = attrs.align === 'center' || attrs.align === 'right' ? attrs.align : 'left'
  return { color, thicknessPx, widthPct, align }
}

const HorizontalRuleWithStyle = HorizontalRule.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: { default: buildHrStyle(HR_DEFAULT_STYLE) },
      align: { default: HR_DEFAULT_STYLE.align },
    }
  },
})
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
    highlightColor: {
      setHighlightColor: (color: string) => ReturnType
      unsetHighlightColor: () => ReturnType
    }
  }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).run(),
    }
  },
})

const HighlightColor = Extension.create({
  name: 'highlightColor',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          highlightColor: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
            renderHTML: (attributes: { highlightColor?: string | null }) => {
              if (!attributes.highlightColor) return {}
              return { style: `background-color: ${attributes.highlightColor}` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setHighlightColor:
        (color: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { highlightColor: color }).run(),
      unsetHighlightColor:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { highlightColor: null }).run(),
    }
  },
})

const FONT_SIZE_VALUES_PX = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48]
const FONT_SIZES: { label: string; value: string | null }[] = [
  { label: 'Normal (défaut)', value: null },
  ...FONT_SIZE_VALUES_PX.map((px) => ({ label: String(px), value: `${px}px` })),
]

const HIGHLIGHT_SWATCHES = [
  { label: 'Jaune', value: '#FEF3E2' },
  { label: 'Vert', value: '#E6F4ED' },
  { label: 'Bleu', value: '#E8EBFA' },
  { label: 'Rose', value: '#FAE4ED' },
  { label: 'Violet', value: '#F0E6F6' },
  { label: 'Gris', value: '#E8E8E4' },
]

const COLOR_SWATCHES = [
  { label: 'Noir', value: '#0D0D0D' },
  { label: 'Gris', value: '#3D3D3D' },
  { label: 'Bleu', value: '#1130A7' },
  { label: 'Violet', value: '#60207E' },
  { label: 'Rose', value: '#B10F55' },
  { label: 'Succès', value: '#1A7A4A' },
  { label: 'Alerte', value: '#A65C00' },
]

const HR_COLOR_SWATCHES = [
  { label: 'Gris clair', value: '#D1D5DB' },
  { label: 'Gris', value: '#9CA3AF' },
  { label: 'Noir', value: '#0D0D0D' },
  { label: 'Bleu', value: '#1130A7' },
  { label: 'Violet', value: '#60207E' },
  { label: 'Rose', value: '#B10F55' },
]

const HR_THICKNESS_OPTIONS = [
  { label: 'Fin', value: 1 },
  { label: 'Moyen', value: 2 },
  { label: 'Épais', value: 4 },
]

const HR_WIDTH_OPTIONS = [25, 50, 75, 100]

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
}

function useDropdownPanel(ref: React.RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, ref])
  return [open, setOpen] as const
}

function SwatchPanel({
  swatches, onPick, onReset, extra,
}: {
  swatches: { label: string; value: string }[]
  onPick: (value: string) => void
  onReset: () => void
  extra?: React.ReactNode
}) {
  return (
    <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-md border border-gray-100 bg-white p-1.5 shadow-md">
      {swatches.map(({ label, value }) => (
        <button
          key={value}
          type="button"
          title={label}
          onMouseDown={(e) => { e.preventDefault(); onPick(value) }}
          className="h-5 w-5 rounded-full ring-1 ring-inset ring-black/10"
          style={{ backgroundColor: value }}
        />
      ))}
      {extra}
      <button
        type="button"
        title="Réinitialiser"
        onMouseDown={(e) => { e.preventDefault(); onReset() }}
        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-gray-500 ring-1 ring-inset ring-black/10"
      >
        ×
      </button>
    </div>
  )
}

function ColorWheelInput({ onPick, onClose }: { onPick: (value: string) => void; onClose: () => void }) {
  return (
    <label
      title="Autre couleur..."
      className="h-5 w-5 cursor-pointer overflow-hidden rounded-full border-0 p-0 ring-1 ring-inset ring-black/10"
      style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
    >
      <input
        type="color"
        className="h-full w-full cursor-pointer opacity-0"
        onInput={(e) => onPick((e.target as HTMLInputElement).value)}
        onChange={(e) => onPick(e.target.value)}
        onBlur={onClose}
      />
    </label>
  )
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
  const colorPanelRef = useRef<HTMLDivElement>(null)
  const [colorPanelOpen, setColorPanelOpen] = useDropdownPanel(colorPanelRef)
  const highlightPanelRef = useRef<HTMLDivElement>(null)
  const [highlightPanelOpen, setHighlightPanelOpen] = useDropdownPanel(highlightPanelRef)
  const sizePanelRef = useRef<HTMLDivElement>(null)
  const [sizePanelOpen, setSizePanelOpen] = useDropdownPanel(sizePanelRef)
  const hrPanelRef = useRef<HTMLDivElement>(null)
  const [hrPanelOpen, setHrPanelOpen] = useDropdownPanel(hrPanelRef)
  const [hrSettings, setHrSettings] = useState(HR_DEFAULT_STYLE)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {}, orderedList: {}, heading: { levels: [2, 3] }, horizontalRule: false,
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      LinkWithStyle.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
      }),
      TextStyle,
      Color,
      FontSize,
      HighlightColor,
      ImageWithStyle,
      HorizontalRuleWithStyle,
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

  const handleImageChosen = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = '' // permet de resélectionner le même fichier ensuite
      if (!file || !editor) return
      if (file.size > MAX_IMAGE_BYTES) {
        window.alert('Image trop lourde (max 2 Mo) — réduis-la avant de l’insérer.')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const src = reader.result as string
        editor.chain().focus().setImage({ src, style: IMAGE_FULL_WIDTH_STYLE } as { src: string }).run()
      }
      reader.readAsDataURL(file)
    },
    [editor],
  )

  const insertCtaButton = useCallback(() => {
    if (!editor) return
    const input = window.prompt('Adresse du lien (URL)', 'https://')
    if (input === null) return // annulé
    const url = input.trim()
    if (url === '') return
    const href = /^(https?:\/\/|mailto:|tel:)/i.test(url) ? url : `https://${url}`
    const label = window.prompt('Texte du bouton', 'En savoir plus')?.trim() || 'En savoir plus'
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text: label,
        marks: [{ type: 'link', attrs: { href, style: CTA_BUTTON_STYLE } }],
      })
      .run()
  }, [editor])

  const openHrPanel = () => {
    if (!editor) return
    if (!hrPanelOpen && editor.isActive('horizontalRule')) {
      const attrs = editor.getAttributes('horizontalRule') as { style?: string | null; align?: string | null }
      setHrSettings(parseHrSettings(attrs))
    }
    setHrPanelOpen((open) => !open)
  }

  const applyHr = (next: Partial<typeof HR_DEFAULT_STYLE>) => {
    if (!editor) return
    const merged = { ...hrSettings, ...next }
    setHrSettings(merged)
    const style = buildHrStyle(merged)
    if (editor.isActive('horizontalRule')) {
      editor.chain().focus().updateAttributes('horizontalRule', { style, align: merged.align }).run()
    } else {
      editor.chain().focus().insertContent({ type: 'horizontalRule', attrs: { style, align: merged.align } }).run()
    }
  }

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
            <SwatchPanel
              swatches={COLOR_SWATCHES}
              onPick={(v) => { editor.chain().focus().setColor(v).run(); setColorPanelOpen(false) }}
              onReset={() => { editor.chain().focus().unsetColor().run(); setColorPanelOpen(false) }}
              extra={
                <ColorWheelInput
                  onPick={(v) => editor.chain().focus().setColor(v).run()}
                  onClose={() => setColorPanelOpen(false)}
                />
              }
            />
          )}
        </div>
        <div className="relative" ref={sizePanelRef}>
          <ToolbarButton
            onClick={() => setSizePanelOpen((open) => !open)}
            active={sizePanelOpen || !!editor.getAttributes('textStyle').fontSize}
            title="Taille du texte"
          >
            <ALargeSmall size={14} />
          </ToolbarButton>
          {sizePanelOpen && (
            <div className="absolute left-0 top-full z-10 mt-1 flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-md border border-gray-100 bg-white p-1.5 shadow-md">
              {FONT_SIZES.map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    if (value) editor.chain().focus().setFontSize(value).run()
                    else editor.chain().focus().unsetFontSize().run()
                    setSizePanelOpen(false)
                  }}
                  style={{ fontSize: value ?? '14px' }}
                  className="whitespace-nowrap rounded px-2 py-1 text-left text-gray-700 hover:bg-gray-100"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative" ref={highlightPanelRef}>
          <ToolbarButton
            onClick={() => setHighlightPanelOpen((open) => !open)}
            active={highlightPanelOpen || !!editor.getAttributes('textStyle').highlightColor}
            title="Surligner"
          >
            <Highlighter size={14} />
          </ToolbarButton>
          {highlightPanelOpen && (
            <SwatchPanel
              swatches={HIGHLIGHT_SWATCHES}
              onPick={(v) => { editor.chain().focus().setHighlightColor(v).run(); setHighlightPanelOpen(false) }}
              onReset={() => { editor.chain().focus().unsetHighlightColor().run(); setHighlightPanelOpen(false) }}
              extra={
                <ColorWheelInput
                  onPick={(v) => editor.chain().focus().setHighlightColor(v).run()}
                  onClose={() => setHighlightPanelOpen(false)}
                />
              }
            />
          )}
        </div>
        <Divider />
        {btn('Titre', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
        {btn('Liste', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {btn('Liste numérotée', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        <div className="relative" ref={hrPanelRef}>
          <ToolbarButton
            onClick={openHrPanel}
            active={hrPanelOpen || editor.isActive('horizontalRule')}
            title="Barre de séparation"
          >
            <Minus size={14} />
          </ToolbarButton>
          {hrPanelOpen && (
            <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-gray-100 bg-white p-2 shadow-md">
              <div className="mb-1.5 text-[11px] font-medium text-gray-500">Couleur</div>
              <div className="mb-2 flex items-center gap-1">
                {HR_COLOR_SWATCHES.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    title={label}
                    onMouseDown={(e) => { e.preventDefault(); applyHr({ color: value }) }}
                    className="h-5 w-5 rounded-full ring-1 ring-inset ring-black/10"
                    style={{ backgroundColor: value }}
                  />
                ))}
                <ColorWheelInput onPick={(v) => applyHr({ color: v })} onClose={() => {}} />
              </div>
              <div className="mb-1.5 text-[11px] font-medium text-gray-500">Épaisseur</div>
              <div className="mb-2 flex gap-1">
                {HR_THICKNESS_OPTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); applyHr({ thicknessPx: value }) }}
                    className={[
                      'rounded px-2 py-1 text-xs',
                      hrSettings.thicknessPx === value
                        ? 'bg-purple/10 text-purple'
                        : 'text-gray-600 hover:bg-gray-100',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mb-1.5 text-[11px] font-medium text-gray-500">Largeur</div>
              <div className="mb-2 flex gap-1">
                {HR_WIDTH_OPTIONS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); applyHr({ widthPct: pct }) }}
                    className={[
                      'rounded px-2 py-1 text-xs',
                      hrSettings.widthPct === pct
                        ? 'bg-purple/10 text-purple'
                        : 'text-gray-600 hover:bg-gray-100',
                    ].join(' ')}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <div className="mb-1.5 text-[11px] font-medium text-gray-500">Alignement</div>
              <div className="flex gap-1">
                {(
                  [
                    { align: 'left' as HrAlign, icon: AlignLeft, title: 'Gauche' },
                    { align: 'center' as HrAlign, icon: AlignCenter, title: 'Centré' },
                    { align: 'right' as HrAlign, icon: AlignRight, title: 'Droite' },
                  ]
                ).map(({ align, icon: Icon, title }) => (
                  <button
                    key={align}
                    type="button"
                    title={title}
                    onMouseDown={(e) => { e.preventDefault(); applyHr({ align }) }}
                    className={[
                      'flex h-6 w-6 items-center justify-center rounded',
                      hrSettings.align === align
                        ? 'bg-purple/10 text-purple'
                        : 'text-gray-600 hover:bg-gray-100',
                    ].join(' ')}
                  >
                    <Icon size={13} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <Divider />
        <ToolbarButton onClick={() => imageInputRef.current?.click()} title="Insérer une image">
          <ImagePlus size={14} />
        </ToolbarButton>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChosen}
        />
        <Divider />
        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Insérer un lien">
          <Link2 size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={insertCtaButton} title="Insérer un bouton (CTA)">
          <MousePointerClick size={14} />
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
        .tiptap img { max-width: 100%; height: auto; }
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
