import { useState } from "react";
import { IconChevronDown, IconCompany, IconWarning } from '@/components/ui/icons'
import type {
  SireneEtablissement,
  SirenSearchResult,
} from "@/types/sourcing";
import {
  formatSiret,
  displayName,
  displayAddress,
} from "@/types/sourcing";
import type { CompanyWithSalePerson } from "@/types/entreprise";
import { fullName } from "@/store/authStore";
import { apiFetch } from "@/api/httpClient";

interface LinkedEstablishmentsProps {
  siren: string;
  currentSiret: string | null;
  onAdd: (etab: SireneEtablissement) => void;
  onOpenCompany: (item: CompanyWithSalePerson) => void;
}

export default function LinkedEstablishments({
  siren,
  currentSiret,
  onAdd,
  onOpenCompany,
}: LinkedEstablishmentsProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SirenSearchResult | null>(null);
  const [error, setError] = useState<"notfound" | "server" | null>(null);

  const handleFetch = async () => {
    if (!siren || siren.length !== 9) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/sourcing/${siren}`);
      if (res.status === 404) {
        setError("notfound");
        return;
      }
      if (!res.ok) {
        setError("server");
        return;
      }
      const data: SirenSearchResult = await res.json();
      setResult(data);
    } catch {
      setError("server");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
    } else {
      setExpanded(true);
      if (!result && !loading) {
        await handleFetch();
      }
    }
  };

  if (!siren || siren.length !== 9) return null;

  const filteredCompanies = result
    ? result.companiesWithSale.filter((item) => item.company.siret !== currentSiret)
    : [];

  const filteredEtablissements = result
    ? result.etablissements.filter((e) => e.siret !== currentSiret)
    : [];

  return (
    <div className="border-t border-[var(--ds-border)] pt-6 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <IconCompany className="w-5 h-5 text-blue" />
        <h3 className="text-lg font-semibold text-[var(--ds-text)]">
          Établissements liés (même SIREN)
        </h3>
      </div>

      {!expanded ? (
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 text-blue font-semibold text-sm py-2 px-3 rounded-lg border border-blue-light bg-blue-light/50 hover:bg-blue-light cursor-pointer transition-colors"
        >
          <IconChevronDown className="w-4 h-4" />
          Voir les établissements liés (même SIREN)
        </button>
      ) : (
        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error === "notfound" && (
            <div className="text-center py-6 px-4 bg-[var(--ds-surface-sunken)] rounded-lg">
              <IconWarning className="w-6 h-6 text-[var(--ds-text-subtle)] mx-auto mb-2" />
              <p className="text-sm text-[var(--ds-text-muted)]">Aucun établissement trouvé</p>
            </div>
          )}

          {error === "server" && (
            <div className="text-center py-6 px-4 bg-[var(--ds-danger-bg)] rounded-lg">
              <p className="text-sm text-[var(--ds-danger)]">
                Erreur de connexion au registre INSEE
              </p>
            </div>
          )}

          {!loading && !error && result && (
            <>
              {result.allBlacklisted ? (
                <div className="text-center py-6 px-4 bg-[var(--ds-danger-bg)] rounded-lg flex flex-col items-center gap-2">
                  <IconWarning className="w-6 h-6 text-[var(--ds-danger)]" />
                  <p className="text-sm font-semibold text-[var(--ds-danger)]">
                    {result.message ?? 'Cette entreprise est blacklisté vous ne pouvez donc pas la prospecter'}
                  </p>
                </div>
              ) : (
                <>
                  {result.blacklisted.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--ds-text-muted)] mb-3">
                        Entreprise blacklisté
                      </h4>
                      <div className="flex flex-col gap-2">
                        {result.blacklisted.map((b, i) => (
                          <div
                            key={`${b.siret}-${i}`}
                            className="bg-[var(--ds-danger-bg)] border border-danger/20 rounded-lg px-4 py-3 flex items-center gap-3"
                          >
                            <span className="w-8 h-8 flex-shrink-0 rounded-md bg-[var(--ds-danger-bg)] text-[var(--ds-danger)] flex items-center justify-center">
                              <IconCompany className="w-4 h-4" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[var(--ds-text)] truncate">
                                {b.name ?? 'Établissement'}
                              </p>
                              <p className="text-xs text-[var(--ds-text-subtle)] font-mono">
                                {formatSiret(b.siret ?? '')}
                              </p>
                              {b.conclusion && (
                                <p className="text-xs text-[var(--ds-text-subtle)] mt-1">{b.conclusion}</p>
                              )}
                            </div>
                            <span className="inline-flex items-center text-xs font-semibold py-1 px-2 rounded-full bg-[var(--ds-danger-bg)] text-[var(--ds-danger)] flex-shrink-0">
                              Blacklisté
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredCompanies.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--ds-text-muted)] mb-3">
                        Établissements existants dans le portefeuille
                      </h4>
                      <div className="flex flex-col gap-2">
                        {filteredCompanies.map(({ company, salePerson }) => (
                          <button
                            key={company.id}
                            type="button"
                            onClick={() => onOpenCompany({ company, salePerson })}
                            className="text-left bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-lg px-4 py-3 flex items-center gap-3 hover:border-blue hover:shadow-sm transition-all cursor-pointer"
                          >
                            <span className="w-8 h-8 flex-shrink-0 rounded-md bg-blue-light text-blue flex items-center justify-center">
                              <IconCompany className="w-4 h-4" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[var(--ds-text)] truncate">
                                {company.name}
                              </p>
                              <p className="text-xs text-[var(--ds-text-subtle)] font-mono">
                                {formatSiret(company.siret ?? "")}
                              </p>
                            </div>
                            {salePerson && (
                              <span className="inline-flex items-center text-xs font-semibold py-1 px-2 rounded-full bg-blue-light text-blue flex-shrink-0 whitespace-nowrap">
                                {fullName(salePerson)}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredEtablissements.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--ds-text-muted)] mb-3">
                        Établissements à ajouter
                      </h4>
                      <div className="flex flex-col gap-2">
                        {filteredEtablissements.map((etab) => {
                          const name = displayName(etab);
                          const address = displayAddress(etab.adresse);
                          const closed = etab.etatAdministratif === "F";

                          return (
                            <div
                              key={etab.siret}
                              className="bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-lg px-4 py-3 flex items-center gap-3 justify-between"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="w-8 h-8 flex-shrink-0 rounded-md bg-green-light text-[var(--ds-success)] flex items-center justify-center">
                                  <IconCompany className="w-4 h-4" />
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-[var(--ds-text)] truncate">
                                    {name}
                                  </p>
                                  <p className="text-xs text-[var(--ds-text-subtle)] font-mono">
                                    {formatSiret(etab.siret)}
                                  </p>
                                  {address && (
                                    <p className="text-xs text-[var(--ds-text-subtle)] mt-1 truncate">
                                      {address}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span
                                  className={[
                                    "inline-flex items-center text-xs font-semibold py-1 px-2 rounded-full flex-shrink-0",
                                    closed
                                      ? "bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]"
                                      : "bg-[var(--ds-success-bg)] text-[var(--ds-success)]",
                                  ].join(" ")}
                                >
                                  {closed ? "Cessée" : "En activité"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onAdd(etab)}
                                  className="flex items-center gap-2 bg-blue text-white font-semibold text-sm py-1.5 px-3 rounded-lg hover:bg-blue-dark cursor-pointer transition-colors border-0 flex-shrink-0"
                                >
                                  Ajouter
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {filteredCompanies.length === 0 &&
                    filteredEtablissements.length === 0 &&
                    result.blacklisted.length === 0 && (
                      <p className="text-center text-sm text-[var(--ds-text-subtle)] py-4">
                        Aucun autre établissement
                      </p>
                    )}
                </>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="w-full text-[var(--ds-text-muted)] font-medium text-sm py-2 hover:text-[var(--ds-text)] transition-colors"
          >
            Réduire
          </button>
        </div>
      )}
    </div>
  );
}
