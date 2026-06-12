import { useEffect, useState, useCallback } from "react";
import type { CompanyWithSalePerson } from "@/types/entreprise";
import {
  Search,
  X,
  Copy,
  Check,
  Clock,
  ArrowRight,
  AlertTriangle,
  Building2,
  ExternalLink,
  Mail,
  Phone,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { NAF_CODES } from "@/data/nafCodes";
import {
  normalizeSiret,
  formatSiret,
  formatSiren,
  displayName,
  displayCity,
  displayAddress,
  type SireneEtablissement,
  type SirenSearchResult,
} from "@/types/sourcing";

const API_BASE = import.meta.env.VITE_API_URL;
const LS_KEY = "siren_recents_v1";
const EXAMPLES = ["803396719", "912345678", "392824714"];
const MAX_RECENTS = 4;

interface RecentEntry {
  name: string;
  siren: string;
}

interface SireneListHeader {
  total: number;
  debut: number;
  nombre: number;
  offset: number;
}

interface SireneListResult {
  header: SireneListHeader;
  etablissements: SireneEtablissement[];
}

interface SireneCriterion {
  paramName: string;
  value: string;
}

type View = "empty" | "loading" | "result" | "notfound";
type ErrKind = "invalid" | "missing" | "server" | "none";
type CommuneView = "empty" | "loading" | "results" | "notfound" | "error";

const denormalizeCommune = (normalized: string): string => {
  return normalized
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("-");
};

const LEGAL_FORMS: Record<string, string> = {
  "5710": "SAS",
  "5720": "SASU",
  "5499": "SARL",
  "5498": "SARL",
  "5599": "SA",
  "5505": "SA",
  "1000": "Entrepreneur individuel",
  "5410": "SARL",
  "5710_LABEL": "Société par actions simplifiée",
};

const REUNION_COMMUNES = [
  "cilaos",
  "entre-deux",
  "la-plaine-des-cafres",
  "la-possession",
  "petite-ile",
  "piton-saint-leu",
  "saint-andre",
  "sainte-marie",
  "sainte-rose",
  "sainte-suzanne",
  "saint-benoit",
  "saint-denis",
  "saint-gilles-les-bains",
  "saint-gilles-les-hauts",
  "saint-joseph",
  "saint-leu",
  "saint-louis",
  "saint-paul",
  "saint-philippe",
  "salazie",
  "tampon",
  "trois-bassins",
];

function legalFormShort(code: string | null): string {
  if (!code) return "—";
  return LEGAL_FORMS[code] || code;
}

async function fetchCompaniesByCriteria(
  criteria: SireneCriterion[],
  token: string | null,
  offset = 0,
): Promise<SireneListResult> {
  const res = await fetch(
    `${API_BASE}/api/sourcing/multicriteria?offset=${offset}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ criteria }),
    },
  );
  if (res.status === 404) throw new Error("notfound");
  if (!res.ok) throw new Error("server");
  return (await res.json()) as SireneListResult;
}

function buildCriteria(commune: string, naf: string): SireneCriterion[] {
  const criteria: SireneCriterion[] = [];
  if (commune.trim()) {
    criteria.push({
      paramName: "libelleCommuneEtablissement",
      value: denormalizeCommune(commune.trim()),
    });
  }
  if (naf.trim()) {
    criteria.push({ paramName: "activitePrincipaleUniteLegale", value: naf.trim() });
  }
  return criteria;
}

function SirenSearchBar({
  value,
  onChange,
  onSubmit,
  busy,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error: boolean;
}) {
  const digits = normalizeSiret(value);
  return (
    <form
      className={[
        "flex items-center gap-2.5 bg-white border-[1.5px] rounded-[14px] py-[7px] pl-[14px] pr-2 transition-[border-color,box-shadow] duration-[180ms]",
        error
          ? "border-danger shadow-[0_0_0_4px_var(--color-danger-bg)]"
          : "border-gray-100 focus-within:border-blue focus-within:shadow-[0_0_0_4px_var(--color-blue-light)]",
      ].join(" ")}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <span
        className={["flex", error ? "text-danger" : "text-gray-500"].join(" ")}
      >
        <Search className="w-5 h-5" />
      </span>
      <input
        className="flex-1 border-0 outline-none bg-transparent text-[15px] font-medium text-gray-900 placeholder:text-gray-300 placeholder:font-normal"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Entrez un numéro SIREN (9 chiffres)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="font-mono text-[12px] text-gray-300 flex-shrink-0">
        {digits.length}/9
      </span>
      {value && (
        <button
          type="button"
          className="flex border-0 bg-gray-50 text-gray-500 w-[26px] h-[26px] rounded-full items-center justify-center cursor-pointer flex-shrink-0 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => onChange("")}
          aria-label="Effacer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <button
        type="submit"
        disabled={busy}
        className="flex items-center gap-1.5 flex-shrink-0 border-0 cursor-pointer bg-blue text-white font-semibold text-[14px] py-[9px] px-4 rounded-[10px] min-w-[120px] justify-center hover:bg-blue-dark active:translate-y-[1px] disabled:opacity-85 disabled:cursor-default max-sm:min-w-[46px] max-sm:px-[9px]"
      >
        {busy ? (
          <span className="w-4 h-4 border-2 border-white/45 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <span className="max-sm:hidden">Rechercher</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}

interface CopyFieldProps {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}

function CopyField({ label, value, mono, wide }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(value.replace(/\s/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div
      className={[
        "bg-white py-[18px] px-[26px]",
        wide ? "col-span-full" : "",
      ].join(" ")}
    >
      <span className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-500">
        {label}
      </span>
      <button
        className="group inline-flex items-center gap-[9px] mt-2 border-0 bg-transparent cursor-pointer p-0 text-[18px] font-semibold text-gray-900"
        onClick={copy}
        title="Copier"
      >
        <span className={mono ? "font-mono tracking-[-0.01em]" : ""}>
          {value}
        </span>
        <span
          className={[
            "flex transition-colors duration-150",
            copied ? "text-success" : "text-gray-300 group-hover:text-blue",
          ].join(" ")}
        >
          {copied ? (
            <Check className="w-[15px] h-[15px]" />
          ) : (
            <Copy className="w-[15px] h-[15px]" />
          )}
        </span>
      </button>
    </div>
  );
}

interface ResultCardProps {
  data: SireneEtablissement;
  onAdditionalSearch?: () => void;
  additionalSearchLoading?: boolean;
}

function ResultCard({
  data,
  onAdditionalSearch,
  additionalSearchLoading,
}: ResultCardProps) {
  const closed = data.etatAdministratif === "F";
  const name = displayName(data);
  const legalShort = legalFormShort(data.categorieJuridique);
  const city = displayCity(data.adresse);
  const address = displayAddress(data.adresse);

  return (
    <article className="bg-white border border-gray-100 rounded-[20px] shadow-[0_1px_2px_rgba(13,13,13,0.04),0_8px_28px_rgba(13,13,13,0.06)] overflow-hidden animate-[rise_0.34s_cubic-bezier(0.2,0.7,0.3,1)_both]">
      <div className="flex items-center gap-4 py-6 px-[26px] bg-gradient-to-b from-blue-light to-white border-b border-gray-100">
        <span className="w-[52px] h-[52px] flex-shrink-0 rounded-[10px] bg-blue text-white flex items-center justify-center">
          <Building2 className="w-[26px] h-[26px]" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-[24px] font-extrabold text-black tracking-[-0.02em] leading-[1.1]">
              {name}
            </h2>
            {data.categorieJuridique && (
              <span className="text-[12px] font-bold py-[3px] px-[9px] rounded-full bg-purple-light text-purple tracking-[0.01em]">
                {legalShort}
              </span>
            )}
          </div>
          {(city || data.siegeSocial) && (
            <p className="text-[13.5px] text-gray-500 mt-[5px] font-normal">
              {data.siegeSocial && <>Siège social{city ? " · " : ""}</>}
              {city}
            </p>
          )}
        </div>
        <span
          className={[
            "inline-flex items-center gap-1.5 flex-shrink-0 text-[12.5px] font-semibold py-[5px] px-[11px] rounded-full",
            closed ? "bg-danger-bg text-danger" : "bg-success-bg text-success",
          ].join(" ")}
        >
          <span
            className={[
              "w-[7px] h-[7px] rounded-full",
              closed ? "bg-danger" : "bg-success",
            ].join(" ")}
          />
          {closed ? "Cessée" : "En activité"}
        </span>
        {data.alreadyExists && (
          <span className="inline-flex items-center gap-1.5 flex-shrink-0 text-[12.5px] font-semibold py-[5px] px-[11px] rounded-full bg-[#FFF3CD] text-[#856404]">
            Déjà dans le portefeuille
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px bg-gray-100 max-sm:grid-cols-1">
        <CopyField label="SIREN" value={formatSiren(data.siren)} mono />
        <CopyField label="SIRET (siège)" value={formatSiret(data.siret)} mono />
        {address && (
          <div className="bg-white py-[18px] px-[26px] col-span-full">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-500">
              Adresse
            </span>
            <p className="mt-2 text-[15px] font-medium text-gray-900">
              {address}
            </p>
          </div>
        )}
        {data.categorieEntreprise && (
          <div className="bg-white py-[18px] px-[26px]">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-500">
              Catégorie d'entreprise
            </span>
            <p className="mt-2 text-[15px] font-medium text-gray-900">
              {data.categorieEntreprise}
            </p>
          </div>
        )}
        {data.categorieJuridique && (
          <div className="bg-white py-[18px] px-[26px]">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-500">
              Forme juridique
            </span>
            <div className="flex items-baseline gap-3 mt-2 flex-wrap">
              <span className="text-[18px] font-semibold text-blue bg-blue-light py-[2px] px-[9px] rounded-[6px] font-mono">
                {data.categorieJuridique}
              </span>
              <span className="text-[15px] font-medium text-gray-900">
                {legalShort}
              </span>
            </div>
          </div>
        )}
      </div>

      {onAdditionalSearch && (
        <div className="bg-white py-4 px-[26px] border-t border-gray-100">
          <button
            type="button"
            onClick={onAdditionalSearch}
            disabled={additionalSearchLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue text-white font-semibold text-[14px] py-[12px] px-4 rounded-[10px] hover:bg-blue-dark active:translate-y-[1px] disabled:opacity-85 disabled:cursor-default border-0 cursor-pointer transition-all"
          >
            {additionalSearchLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/45 border-t-white rounded-full animate-spin" />
                <span>Recherche en cours...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Recherche complémentaire</span>
              </>
            )}
          </button>
        </div>
      )}
    </article>
  );
}

function Skeleton() {
  const sk =
    "block rounded-[6px] bg-[linear-gradient(90deg,var(--color-gray-50)_25%,var(--color-gray-100)_37%,var(--color-gray-50)_63%)] bg-[length:400%_100%] animate-[shimmer_1.3s_ease-in-out_infinite]";
  return (
    <article
      className="bg-white border border-gray-100 rounded-[20px] shadow-[0_1px_2px_rgba(13,13,13,0.04),0_8px_28px_rgba(13,13,13,0.06)] overflow-hidden"
      aria-busy="true"
    >
      <div className="flex items-center gap-4 py-6 px-[26px] bg-gradient-to-b from-blue-light to-white border-b border-gray-100">
        <span
          className={`${sk} w-[52px] h-[52px] rounded-[10px] flex-shrink-0`}
        />
        <div className="flex-1">
          <span className={sk} style={{ width: "46%", height: 22 }} />
          <span
            className={sk}
            style={{ width: "62%", height: 13, marginTop: 12 }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-gray-100 max-sm:grid-cols-1">
        {[0, 1].map((i) => (
          <div className="bg-white py-[18px] px-[26px]" key={i}>
            <span className={sk} style={{ width: 60, height: 11 }} />
            <span
              className={sk}
              style={{ width: "80%", height: 18, marginTop: 10 }}
            />
          </div>
        ))}
        <div className="bg-white py-[18px] px-[26px] col-span-full">
          <span className={sk} style={{ width: 120, height: 11 }} />
          <span
            className={sk}
            style={{ width: "70%", height: 18, marginTop: 10 }}
          />
        </div>
      </div>
    </article>
  );
}

interface NotFoundProps {
  kind: ErrKind;
  query: string;
}

function NotFound({ kind, query }: NotFoundProps) {
  let title = "Aucun établissement trouvé";
  let body: React.ReactNode = (
    <>
      Aucune entreprise ne correspond au SIREN{" "}
      <b className="font-mono font-semibold text-gray-900">{query}</b> dans le
      registre INSEE.
    </>
  );
  if (kind === "invalid") {
    title = "Numéro SIREN incomplet";
    body =
      "Un SIREN valide comporte exactement 9 chiffres. Vérifiez la saisie et réessayez.";
  } else if (kind === "server") {
    title = "Erreur de connexion au registre";
    body =
      "Impossible d'interroger le registre INSEE pour le moment. Réessayez dans quelques instants.";
  }

  return (
    <div className="text-center py-11 px-6 max-w-[520px] mx-auto animate-[rise_0.3s_ease_both]">
      <span className="w-[60px] h-[60px] rounded-[14px] mx-auto mb-5 flex items-center justify-center bg-danger-bg text-danger">
        <AlertTriangle className="w-7 h-7" />
      </span>
      <h3 className="text-[21px] font-bold text-black tracking-[-0.01em]">
        {title}
      </h3>
      <p className="text-[14.5px] text-gray-500 mt-[9px] leading-[1.55]">
        {body}
      </p>
    </div>
  );
}

interface EmptyStateProps {
  recents: RecentEntry[];
  examples: string[];
  onPick: (siret: string) => void;
  onClearRecents: () => void;
}

function EmptyState({
  recents,
  examples,
  onPick,
  onClearRecents,
}: EmptyStateProps) {
  return (
    <div className="text-center py-11 px-6 max-w-[520px] mx-auto animate-[rise_0.3s_ease_both]">
      <span className="w-[60px] h-[60px] rounded-[14px] mx-auto mb-5 flex items-center justify-center bg-blue-light text-blue">
        <Search className="w-7 h-7" />
      </span>
      <h3 className="text-[21px] font-bold text-black tracking-[-0.01em]">
        Recherchez une entreprise
      </h3>
      <p className="text-[14.5px] text-gray-500 mt-[9px] leading-[1.55]">
        Saisissez un numéro SIREN à 9 chiffres pour afficher tous les établissements
        de cette unité légale.
      </p>

      <div className="flex items-center justify-center gap-2 flex-wrap mt-[26px]">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-gray-300">
          Exemples
        </span>
        {examples.map((s) => (
          <button
            key={s}
            type="button"
            className="border border-gray-100 bg-white text-gray-700 text-[13px] font-semibold py-[7px] px-3 rounded-full cursor-pointer transition-all duration-150 font-mono tracking-[-0.01em] hover:border-blue hover:text-blue hover:bg-blue-light"
            onClick={() => onPick(s)}
          >
            {formatSiren(s)}
          </button>
        ))}
      </div>

      {recents.length > 0 && (
        <div className="mt-[34px] text-left">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="flex items-center gap-[7px] text-[12px] font-semibold uppercase tracking-[0.06em] text-gray-500">
              <Clock className="w-[15px] h-[15px]" /> Recherches récentes
            </span>
            <button
              type="button"
              className="border-0 bg-transparent text-blue font-semibold text-[13px] cursor-pointer hover:text-blue-dark"
              onClick={onClearRecents}
            >
              Effacer
            </button>
          </div>
          <ul className="list-none flex flex-col gap-2 p-0">
            {recents.map((r) => (
              <li key={r.siren}>
                <button
                  type="button"
                  className="w-full flex items-center gap-[13px] text-left cursor-pointer bg-white border border-gray-100 rounded-[10px] py-3 px-3.5 transition-all duration-150 hover:border-blue hover:shadow-[0_4px_14px_rgba(17,48,167,0.08)] hover:-translate-y-px"
                  onClick={() => onPick(r.siren)}
                >
                  <span className="w-[34px] h-[34px] flex-shrink-0 rounded-lg bg-gray-50 text-gray-500 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </span>
                  <span className="flex-1 flex flex-col gap-[2px] min-w-0">
                    <span className="text-[14.5px] font-semibold text-gray-900">
                      {r.name}
                    </span>
                    <span className="text-[12.5px] text-gray-500 font-mono tracking-[-0.01em]">
                      {formatSiren(r.siren)}
                    </span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface ContactCardProps {
  name: string;
  value: string;
}

const isUrl = (v: string) => /^https?:\/\//i.test(v);
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v: string) => /^\+?[\d][\d\s.\-()]{7,}$/.test(v);

function ContactCard({ name, value }: ContactCardProps) {
  const [copied, setCopied] = useState(false);

  const href = isUrl(value)
    ? value
    : isEmail(value)
      ? `mailto:${value}`
      : isPhone(value)
        ? `tel:${value.replace(/[^\d+]/g, "")}`
        : null;

  const Icon = isUrl(value)
    ? ExternalLink
    : isEmail(value)
      ? Mail
      : isPhone(value)
        ? Phone
        : Copy;

  const cardClass =
    "bg-white border border-gray-100 rounded-[10px] px-4 py-3 flex flex-col gap-1.5 text-left hover:border-blue/30 transition-colors cursor-pointer";

  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-500">
          {name}
        </span>
        {copied ? (
          <Check className="w-3.5 h-3.5 text-success flex-shrink-0" />
        ) : (
          <Icon className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
        )}
      </span>
      <span className="text-[15px] font-medium text-gray-900 break-all">
        {value}
      </span>
    </>
  );

  // Links / emails / phones are directly actionable.
  if (href) {
    return (
      <a
        href={href}
        target={isUrl(value) ? "_blank" : undefined}
        rel="noopener noreferrer"
        className={cardClass}
      >
        {body}
      </a>
    );
  }

  // Plain text (legal rep name, postal address…) stays copy-to-clipboard.
  const copy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button type="button" onClick={copy} className={cardClass}>
      {body}
    </button>
  );
}

function ModeTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-5 py-2 rounded-full text-[13px] font-semibold transition-all duration-150 border",
        active
          ? "bg-blue text-white border-blue shadow-[0_2px_8px_-2px_rgba(17,48,167,0.35)]"
          : "bg-white text-gray-500 border-gray-100 hover:border-blue/30 hover:text-blue",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function MulticriteriaSearchBar({
  communeValue,
  onCommuneChange,
  nafValue,
  onNafChange,
  onSubmit,
  busy,
}: {
  communeValue: string;
  onCommuneChange: (v: string) => void;
  nafValue: string;
  onNafChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const hasValue = !!(communeValue.trim() || nafValue.trim());
  return (
    <form
      className="flex flex-col gap-2.5 sm:flex-row sm:items-center bg-white border-[1.5px] border-gray-100 rounded-[14px] py-[7px] pl-[14px] pr-2 transition-[border-color,box-shadow] duration-[180ms] focus-within:border-blue focus-within:shadow-[0_0_0_4px_var(--color-blue-light)]"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <span className="flex text-gray-500">
        <Search className="w-5 h-5" />
      </span>
      <select
        className="flex-1 border-0 outline-none bg-transparent text-[15px] font-medium text-gray-900 cursor-pointer"
        value={communeValue}
        onChange={(e) => onCommuneChange(e.target.value)}
      >
        <option value="">Sélectionnez une commune</option>
        {REUNION_COMMUNES.map((commune) => (
          <option key={commune} value={commune}>
            {commune
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join("-")}
          </option>
        ))}
      </select>
      <select
        className="flex-1 border-0 outline-none bg-transparent text-[15px] font-medium text-gray-900 cursor-pointer"
        value={nafValue}
        onChange={(e) => onNafChange(e.target.value)}
      >
        <option value="">Tous secteurs (NAF)</option>
        {NAF_CODES.map((n) => (
          <option key={n.code} value={n.code}>
            {n.libelle}
          </option>
        ))}
      </select>
      {hasValue && (
        <button
          type="button"
          className="flex border-0 bg-gray-50 text-gray-500 w-[26px] h-[26px] rounded-full items-center justify-center cursor-pointer flex-shrink-0 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => {
            onCommuneChange("");
            onNafChange("");
          }}
          aria-label="Effacer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <button
        type="submit"
        disabled={busy || !hasValue}
        className="flex items-center gap-1.5 flex-shrink-0 border-0 cursor-pointer bg-blue text-white font-semibold text-[14px] py-[9px] px-4 rounded-[10px] min-w-[120px] justify-center hover:bg-blue-dark active:translate-y-[1px] disabled:opacity-85 disabled:cursor-default max-sm:min-w-[46px] max-sm:px-[9px]"
      >
        {busy ? (
          <span className="w-4 h-4 border-2 border-white/45 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <span className="max-sm:hidden">Rechercher</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}

function CommuneSkeleton() {
  const sk =
    "block rounded-[6px] bg-[linear-gradient(90deg,var(--color-gray-50)_25%,var(--color-gray-100)_37%,var(--color-gray-50)_63%)] bg-[length:400%_100%] animate-[shimmer_1.3s_ease-in-out_infinite]";
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-white border border-gray-100 rounded-[14px] px-5 py-4 flex items-center gap-4"
        >
          <span className={`${sk} w-9 h-9 rounded-[8px] flex-shrink-0`} />
          <div className="flex-1">
            <span className={sk} style={{ width: "50%", height: 15 }} />
            <span
              className={sk}
              style={{ width: "35%", height: 12, marginTop: 8 }}
            />
          </div>
          <span
            className={sk}
            style={{ width: 70, height: 24, borderRadius: 999 }}
          />
        </div>
      ))}
    </div>
  );
}

interface CommuneResultListProps {
  result: SireneListResult;
  selectedSiret?: string;
  onSelect?: (e: SireneEtablissement) => void;
}

function CommuneResultList({
  result,
  selectedSiret,
  onSelect,
}: CommuneResultListProps) {
  return (
    <div>
      <p className="text-[13px] text-gray-500 mb-4 text-center">
        <span className="font-semibold text-gray-900">
          {result.header.nombre}
        </span>{" "}
        établissement{result.header.nombre !== 1 ? "s" : ""} affiché
        {result.header.nombre !== 1 ? "s" : ""} sur{" "}
        <span className="font-semibold text-gray-900">
          {result.header.total.toLocaleString("fr-FR")}
        </span>{" "}
        trouvés
      </p>
      <div className="flex flex-col gap-2">
        {result.etablissements.map((e) => {
          const closed = e.etatAdministratif === "F";
          const name = displayName(e);
          const city = displayCity(e.adresse);
          const isSelected = selectedSiret === e.siret;
          return (
            <button
              key={e.siret}
              type="button"
              onClick={() => onSelect?.(e)}
              className={[
                "text-left bg-white border rounded-[14px] px-5 py-4 flex items-center gap-4 shadow-[0_1px_4px_rgba(13,13,13,0.04)] animate-[rise_0.2s_ease_both] cursor-pointer transition-all border-0",
                isSelected
                  ? "ring-2 ring-blue bg-blue-light/30"
                  : "border-gray-100 hover:border-blue/30",
              ].join(" ")}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <span className="w-9 h-9 flex-shrink-0 rounded-[8px] bg-blue-light text-blue flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-gray-900 truncate">
                    {name}
                  </p>
                  <p className="text-[12.5px] text-gray-500 font-mono tracking-[-0.01em]">
                    {formatSiret(e.siret)}
                    {city ? ` · ${city}` : ""}
                  </p>
                </div>
              </div>
              <div>
                <span
                  className={[
                    "inline-flex items-center gap-1.5 text-[12px] font-semibold py-1 px-2.5 rounded-full flex-shrink-0",
                    closed
                      ? "bg-danger-bg text-danger"
                      : "bg-success-bg text-success",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "w-[6px] h-[6px] rounded-full",
                      closed ? "bg-danger" : "bg-success",
                    ].join(" ")}
                  />
                  {closed ? "Cessée" : "En activité"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExistingCompanyList({ items }: { items: CompanyWithSalePerson[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map(({ company, salePerson }) => (
        <div key={company.id} className="bg-white border border-gray-100 rounded-[14px] px-5 py-4 flex items-center gap-4 shadow-[0_1px_4px_rgba(13,13,13,0.04)] animate-[rise_0.2s_ease_both]">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <span className="w-9 h-9 flex-shrink-0 rounded-[8px] bg-blue-light text-blue flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-gray-900 truncate">{company.name}</p>
              <p className="text-[12.5px] text-gray-500 font-mono tracking-[-0.01em]">
                {formatSiret(company.siret ?? "")}
              </p>
            </div>
          </div>
          {salePerson && (
            <span className="inline-flex items-center text-[12px] font-semibold py-1 px-2.5 rounded-full bg-blue-light text-blue flex-shrink-0">
              {salePerson.name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Sourcing() {
  const token = useAuthStore((s) => s.token);

  // SIREN mode state
  const [mode, setMode] = useState<"siren" | "commune">("siren");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("empty");
  const [result, setResult] = useState<SirenSearchResult | null>(null);
  const [selectedEtablissement, setSelectedEtablissement] = useState<SireneEtablissement | null>(null);
  const [errKind, setErrKind] = useState<ErrKind>("none");
  const [additionalSearchLoading, setAdditionalSearchLoading] = useState(false);
  const [contacts, setContacts] = useState<Array<{
    name: string;
    value: string;
  }> | null>(null);

  // Commune mode state
  const [communeQuery, setCommuneQuery] = useState("");
  const [nafCode, setNafCode] = useState("");
  const [communeView, setCommuneView] = useState<CommuneView>("empty");
  const [communeResult, setCommuneResult] = useState<SireneListResult | null>(
    null,
  );
  const [offsetHistory, setOffsetHistory] = useState<number[]>([]);
  const [selectedCommune, setSelectedCommune] =
    useState<SireneEtablissement | null>(null);
  const [recents, setRecents] = useState<RecentEntry[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(recents));
    } catch {
      /* ignore */
    }
  }, [recents]);

  const pushRecent = useCallback((data: SirenSearchResult) => {
    const name =
      data.companiesWithSale[0]?.company.name ||
      displayName(data.etablissements[0]) ||
      "Entreprise";
    const entry: RecentEntry = {
      name,
      siren: data.siren,
    };
    setRecents((prev) => {
      const next = [entry, ...prev.filter((r) => r.siren !== entry.siren)];
      return next.slice(0, MAX_RECENTS);
    });
  }, []);

  const run = useCallback(
    async (raw: string) => {
      const digits = normalizeSiret(raw);
      if (digits.length !== 9) {
        setErrKind("invalid");
        setView("notfound");
        return;
      }
      setErrKind("none");
      setView("loading");
      setSelectedEtablissement(null);
      setContacts(null);
      try {
        const res = await fetch(`${API_BASE}/api/sourcing/${digits}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.status === 404) {
          setErrKind("missing");
          setView("notfound");
          return;
        }
        if (!res.ok) {
          setErrKind("server");
          setView("notfound");
          return;
        }
        const data = (await res.json()) as SirenSearchResult;
        setResult(data);
        setView("result");
        pushRecent(data);
      } catch {
        setErrKind("server");
        setView("notfound");
      }
    },
    [token, pushRecent],
  );

  const runCommune = useCallback(
    async () => {
      const criteria = buildCriteria(communeQuery, nafCode);
      if (criteria.length === 0) return;
      setCommuneView("loading");
      setOffsetHistory([]);
      setSelectedCommune(null);
      try {
        const data = await fetchCompaniesByCriteria(criteria, token, 0);
        setCommuneResult(data);
        setCommuneView(data.etablissements.length > 0 ? "results" : "notfound");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "server";
        setCommuneView(msg === "notfound" ? "notfound" : "error");
      }
    },
    [communeQuery, nafCode, token],
  );

  const loadNextPage = useCallback(
    async () => {
      if (!communeResult) return;
      const criteria = buildCriteria(communeQuery, nafCode);
      if (criteria.length === 0) return;
      const nextOffset =
        communeResult.header.offset + communeResult.etablissements.length;
      setOffsetHistory((h) => [...h, communeResult.header.offset]);
      setCommuneView("loading");
      setSelectedCommune(null);
      try {
        const data = await fetchCompaniesByCriteria(criteria, token, nextOffset);
        setCommuneResult(data);
        setCommuneView("results");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "server";
        setCommuneView(msg === "notfound" ? "notfound" : "error");
      }
    },
    [communeQuery, nafCode, communeResult, token],
  );

  const loadPrevPage = useCallback(
    async () => {
      if (!communeResult || offsetHistory.length === 0) return;
      const criteria = buildCriteria(communeQuery, nafCode);
      if (criteria.length === 0) return;
      const prevOffset = offsetHistory[offsetHistory.length - 1];
      setOffsetHistory((h) => h.slice(0, -1));
      setCommuneView("loading");
      setSelectedCommune(null);
      try {
        const data = await fetchCompaniesByCriteria(criteria, token, prevOffset);
        setCommuneResult(data);
        setCommuneView("results");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "server";
        setCommuneView(msg === "notfound" ? "notfound" : "error");
      }
    },
    [communeQuery, nafCode, communeResult, offsetHistory, token],
  );

  const submit = () => run(query);

  const pick = (siren: string) => {
    setQuery(formatSiren(siren));
    run(siren);
  };

  const onChange = (v: string) => {
    setQuery(v);
    if (view !== "empty") {
      setView("empty");
      setErrKind("none");
      setContacts(null);
      setSelectedEtablissement(null);
    }
  };

  const doAdditionalSearch = useCallback(async () => {
    const targetResult = selectedEtablissement || selectedCommune;
    if (!targetResult) return;
    setAdditionalSearchLoading(true);
    setContacts(null);
    try {
      const res = await fetch(`${API_BASE}/api/sourcing/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          siret: targetResult.siret,
          name: displayName(targetResult),
          address: displayAddress(targetResult.adresse),
        }),
      });
      const data = (await res.json()) as {
        contacts: Array<{ name: string; value: string }>;
      };
      setContacts(data.contacts);
    } catch (error) {
      console.error("Recherche complémentaire error:", error);
      setContacts([]);
    } finally {
      setAdditionalSearchLoading(false);
    }
  }, [result, selectedCommune, token]);

  return (
    <div className="min-h-full bg-background">
      <style>{`
        @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
      `}</style>
      <main className="max-w-[760px] mx-auto px-6 pt-10 pb-20">
        {/* Mode tabs */}
        <div className="flex gap-2 mb-8 justify-center">
          <ModeTab
            active={mode === "siren"}
            label="Recherche par SIREN"
            onClick={() => setMode("siren")}
          />
          <ModeTab
            active={mode === "commune"}
            label="Recherche multicritère"
            onClick={() => setMode("commune")}
          />
        </div>

        {/* SIREN mode */}
        {mode === "siren" && (
          <>
            <div className="mb-6">
              <SirenSearchBar
                value={query}
                onChange={onChange}
                onSubmit={submit}
                busy={view === "loading"}
                error={view === "notfound" && errKind === "invalid"}
              />
            </div>
            {view === "loading" && <Skeleton />}
            {view === "result" && result && (
              <>
                {result.companiesWithSale.length === 0 && result.etablissements.length === 0 ? (
                  <NotFound kind="missing" query={formatSiren(query)} />
                ) : (
                  <>
                    {result.companiesWithSale.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-[13px] font-semibold text-gray-700 mb-3">
                          Existantes ({result.companiesWithSale.length})
                        </h3>
                        <ExistingCompanyList items={result.companiesWithSale} />
                      </div>
                    )}
                    {result.etablissements.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-[13px] font-semibold text-gray-700 mb-3">
                          Non existantes ({result.etablissements.length})
                        </h3>
                        {!selectedEtablissement ? (
                          <CommuneResultList
                            result={{
                              header: {
                                nombre: result.etablissements.length,
                                total: result.etablissements.length,
                                debut: 0,
                                offset: 0,
                              },
                              etablissements: result.etablissements,
                            }}
                            onSelect={setSelectedEtablissement}
                          />
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEtablissement(null);
                                setContacts(null);
                              }}
                              className="mb-4 px-4 py-2 border border-gray-200 text-gray-700 font-semibold text-[13px] rounded-[8px] hover:border-gray-300 bg-white cursor-pointer transition-all"
                            >
                              ← Retour à la liste
                            </button>
                            <ResultCard
                              data={selectedEtablissement}
                              onAdditionalSearch={doAdditionalSearch}
                              additionalSearchLoading={additionalSearchLoading}
                            />
                            {contacts && (
                              <div className="mt-6 animate-[rise_0.3s_ease_both]">
                                {contacts.length === 0 ? (
                                  <div className="text-center py-6 px-4 bg-white border border-gray-100 rounded-[14px]">
                                    <p className="text-[14px] text-gray-500">
                                      Aucune information de contact trouvée
                                    </p>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-[13px] font-semibold text-gray-700 mb-3">
                                      {contacts.length} information
                                      {contacts.length !== 1 ? "s" : ""} trouvée
                                      {contacts.length !== 1 ? "s" : ""}
                                    </p>
                                    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                                      {contacts.map((contact, idx) => (
                                        <ContactCard
                                          key={idx}
                                          name={contact.name}
                                          value={contact.value}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {view === "notfound" && (
              <NotFound kind={errKind} query={formatSiren(query)} />
            )}
            {view === "empty" && (
              <EmptyState
                recents={recents}
                examples={EXAMPLES}
                onPick={pick}
                onClearRecents={() => setRecents([])}
              />
            )}
          </>
        )}

        {/* Commune mode */}
        {mode === "commune" && (
          <div>
            <div className="mb-6">
              <MulticriteriaSearchBar
                communeValue={communeQuery}
                onCommuneChange={(v) => {
                  setCommuneQuery(v);
                  if (communeView !== "empty") setCommuneView("empty");
                  setContacts(null);
                  setSelectedCommune(null);
                }}
                nafValue={nafCode}
                onNafChange={(v) => {
                  setNafCode(v);
                  if (communeView !== "empty") setCommuneView("empty");
                  setContacts(null);
                  setSelectedCommune(null);
                }}
                onSubmit={() => runCommune()}
                busy={communeView === "loading"}
              />
            </div>
            {communeView === "empty" && (
              <div className="text-center py-11 animate-[rise_0.3s_ease_both]">
                <span className="w-[60px] h-[60px] rounded-[14px] mx-auto mb-5 flex items-center justify-center bg-blue-light text-blue">
                  <Building2 className="w-7 h-7" />
                </span>
                <h3 className="text-[21px] font-bold text-black tracking-[-0.01em]">
                  Recherche multicritère
                </h3>
                <p className="text-[14.5px] text-gray-500 mt-[9px] leading-[1.55]">
                  Sélectionnez une commune et/ou un secteur d'activité (NAF) pour lister les établissements enregistrés dans le registre INSEE.
                </p>
              </div>
            )}
            {communeView === "loading" && <CommuneSkeleton />}
            {communeView === "results" && communeResult && !selectedCommune && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={loadPrevPage}
                    disabled={offsetHistory.length === 0}
                    className="px-4 py-2 border border-gray-200 text-gray-700 font-semibold text-[13px] rounded-[8px] hover:border-gray-300 bg-white cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Page précédente
                  </button>
                  <button
                    type="button"
                    onClick={loadNextPage}
                    disabled={
                      communeResult.header.offset +
                        communeResult.etablissements.length >=
                      communeResult.header.total
                    }
                    className="px-4 py-2 border border-gray-200 text-gray-700 font-semibold text-[13px] rounded-[8px] hover:border-gray-300 bg-white cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Page suivante →
                  </button>
                </div>
                <CommuneResultList
                  result={communeResult}
                  selectedSiret={undefined}
                  onSelect={setSelectedCommune}
                />
              </div>
            )}
            {communeView === "results" && selectedCommune && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCommune(null);
                    setContacts(null);
                  }}
                  className="mb-4 px-4 py-2 border border-gray-200 text-gray-700 font-semibold text-[13px] rounded-[8px] hover:border-gray-300 bg-white cursor-pointer transition-all"
                >
                  ← Retour à la liste
                </button>
                <ResultCard
                  data={selectedCommune}
                  onAdditionalSearch={doAdditionalSearch}
                  additionalSearchLoading={additionalSearchLoading}
                />
                {contacts && (
                  <div className="mt-6 animate-[rise_0.3s_ease_both]">
                    {contacts.length === 0 ? (
                      <div className="text-center py-6 px-4 bg-white border border-gray-100 rounded-[14px]">
                        <p className="text-[14px] text-gray-500">
                          Aucune information de contact trouvée
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[13px] font-semibold text-gray-700 mb-3">
                          {contacts.length} information
                          {contacts.length !== 1 ? "s" : ""} trouvée
                          {contacts.length !== 1 ? "s" : ""}
                        </p>
                        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                          {contacts.map((contact, idx) => (
                            <ContactCard
                              key={idx}
                              name={contact.name}
                              value={contact.value}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {communeView === "notfound" && (
              <div className="text-center py-11 max-w-[520px] mx-auto animate-[rise_0.3s_ease_both]">
                <span className="w-[60px] h-[60px] rounded-[14px] mx-auto mb-5 flex items-center justify-center bg-danger-bg text-danger">
                  <AlertTriangle className="w-7 h-7" />
                </span>
                <h3 className="text-[21px] font-bold text-black tracking-[-0.01em]">
                  Aucun résultat
                </h3>
                <p className="text-[14.5px] text-gray-500 mt-[9px] leading-[1.55]">
                  Aucun établissement trouvé pour ces critères dans le registre INSEE.
                </p>
              </div>
            )}
            {communeView === "error" && (
              <div className="text-center py-11 max-w-[520px] mx-auto animate-[rise_0.3s_ease_both]">
                <span className="w-[60px] h-[60px] rounded-[14px] mx-auto mb-5 flex items-center justify-center bg-danger-bg text-danger">
                  <AlertTriangle className="w-7 h-7" />
                </span>
                <h3 className="text-[21px] font-bold text-black tracking-[-0.01em]">
                  Erreur de connexion
                </h3>
                <p className="text-[14.5px] text-gray-500 mt-[9px] leading-[1.55]">
                  Impossible d'interroger le registre INSEE. Réessayez dans
                  quelques instants.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
