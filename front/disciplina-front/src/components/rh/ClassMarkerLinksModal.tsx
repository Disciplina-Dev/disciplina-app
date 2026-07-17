import { useEffect, useRef, useState, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Copy, Check, Download, Loader2, AlertCircle, ClipboardCheck, ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { TitleProfessionalType } from '@/types/candidate';
import type { ClassMarkerLink } from '@/types/classmarker';
import { buildCandidateTestUrl } from '@/utils/classmarker';
import {
  fetchClassMarkerLinks,
  quickCreateCandidate,
} from '@/api/classmarker';

interface ClassMarkerLinksModalProps {
  open: boolean;
  onClose: () => void;
  firstName: string;
  lastName: string;
  tpType: TitleProfessionalType;
  candidateId?: string;
}

interface CardEntry {
  link: ClassMarkerLink;
  url: string;
}

export default function ClassMarkerLinksModal({
  open,
  onClose,
  firstName,
  lastName,
  tpType,
  candidateId,
}: ClassMarkerLinksModalProps) {
  const token = useAuthStore(s => s.token);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(candidateId ?? null);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [entries, setEntries] = useState<CardEntry[]>([]);
  // Test sélectionné : on n'affiche que celui-ci (les autres sont masqués).
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, handleEsc]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const run = async () => {
      if (!token) {
        setError('Session expirée');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        let id = candidateId;
        if (!id) {
          if (!firstName.trim() || !lastName.trim()) {
            throw new Error('Prénom et nom requis');
          }
          const created = await quickCreateCandidate(token, {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            tp_type: tpType,
          });
          if (cancelled) return;
          id = created.id;
          setAlreadyExists(created.already_exists);
        }
        setResolvedId(id);

        const links = await fetchClassMarkerLinks(token);
        if (cancelled) return;
        const built = links.map(link => ({
          link,
          url: buildCandidateTestUrl(link.link_url_id, id!),
        }));
        setEntries(built);
        setSelectedId(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [open, candidateId, firstName, lastName, tpType, token]);

  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cm-modal-title"
    >
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-[fadeIn_0.2s_ease-out]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-purple-light)' }}
            >
              <ClipboardCheck size={18} style={{ color: 'var(--color-purple)' }} />
            </div>
            <div>
              <h2 id="cm-modal-title" className="text-lg font-bold text-gray-900">
                Liens de test ClassMarker
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {firstName} {lastName}
                {alreadyExists && ' — candidat déjà existant'}
              </p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-16 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Génération des liens…</span>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-danger-bg text-danger">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="text-sm">{error}</div>
            </div>
          )}

          {!loading && !error && entries.length > 0 && (
            <>
              {selectedId && (
                <button
                  onClick={() => setSelectedId(null)}
                  className="flex items-center gap-1.5 mb-4 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
                >
                  <ArrowLeft size={15} />
                  Tous les tests
                </button>
              )}
              <div
                className={
                  selectedId
                    ? 'grid grid-cols-1 gap-4 max-w-md mx-auto'
                    : 'grid grid-cols-1 md:grid-cols-2 gap-4'
                }
              >
                {(selectedId ? entries.filter(e => e.link.link_id === selectedId) : entries).map(entry => (
                  <LinkCard
                    key={entry.link.link_id}
                    entry={entry}
                    candidateName={`${firstName}_${lastName}`}
                    selectable={!selectedId}
                    onSelect={() => setSelectedId(entry.link.link_id)}
                  />
                ))}
              </div>
            </>
          )}

          {!loading && !error && entries.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-12">Aucun lien disponible.</p>
          )}
        </div>

        {resolvedId && (
          <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-500">
            ID candidat: <span className="font-mono">{resolvedId}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface LinkCardProps {
  entry: CardEntry;
  candidateName: string;
  selectable?: boolean;
  onSelect?: () => void;
}

function LinkCard({ entry, candidateName, selectable = false, onSelect }: LinkCardProps) {
  const [copied, setCopied] = useState(false);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(entry.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const onDownload = () => {
    const canvas = canvasWrapperRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${candidateName}-${entry.link.link_id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 p-4 flex flex-col gap-3 bg-white transition-all ${
        selectable ? 'cursor-pointer hover:border-purple hover:shadow-md' : ''
      }`}
      style={{ borderRadius: 'var(--radius-lg)' }}
      onClick={selectable ? onSelect : undefined}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={
        selectable
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
    >
      <div>
        <h3 className="text-sm font-semibold text-gray-900 leading-tight">
          {entry.link.link_name}
        </h3>
        {entry.link.test_name && (
          <p className="text-xs text-gray-500 mt-1">{entry.link.test_name}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div ref={canvasWrapperRef} className="shrink-0 p-2 bg-white rounded-md border border-gray-100">
          <QRCodeCanvas value={entry.url} size={120} includeMargin={false} />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="block text-xs font-medium truncate underline-offset-2 hover:underline"
            style={{ color: 'var(--color-purple)' }}
            title={entry.url}
          >
            {entry.url}
          </a>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={e => {
                e.stopPropagation();
                onCopy();
              }}
              leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
              aria-label="Copier le lien"
            >
              {copied ? 'Copié !' : 'Copier'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={e => {
                e.stopPropagation();
                onDownload();
              }}
              leftIcon={<Download size={14} />}
              aria-label="Télécharger le QR Code en PNG"
            >
              QR PNG
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
