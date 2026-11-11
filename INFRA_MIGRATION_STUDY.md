# Hosting study — Mac mini (HQ) vs European dedicated server

> Date: 2026-11-11 · Scope: where to host Disciplina production (2 tenants: `disciplina` La Réunion, `disciplina_annemasse`).
> Inputs: `INFRA_RGPD_AUDIT.md` / `GDPR_INF_ISSUES.md`, repo analysis, public provider pages (sources at the end).
> Status labels: **[repo]** verified in the code, **[web]** read on a provider page on 2026-11-11, **[team]** stated by the team, **[to measure]** needs production data, **[to verify]** not confirmed.
> Not legal advice: the DPO validates the GDPR parts.

## 1. Why migrate

The Mac mini is not a GDPR violation by itself (France, no third-country transfer). What fails is **Art. 32** (security, availability, ability to restore), as established by the audit:

| Audit finding | Mac mini today | Fixed by a datacenter host? |
|---|---|---|
| #1 Backups incomplete, in clear, same disk, no off-site | Yes [repo] | Yes (off-site + automation) |
| #2 No encryption at rest | FileVault inactive [team] | Yes (LUKS/provider encryption) |
| #3 Exposed from a home box, unversioned proxy | Port forwarding + host Caddy [team] | Yes (real firewall, private network) |
| #4 Jaeger/OTLP exposed | Fixable in compose, independent of host | No — config fix either way |
| Single point of failure (box, Wi-Fi, power, sleep at 03:00) | Yes [team][repo `README.md:177`] | Yes |
| Annemasse latency / outage when HQ link drops | Yes [team] | Yes |

Business drivers: Annemasse users depend on the Réunion link; a Wi-Fi drop stops both sites; backups cannot be proven restorable.

## 2. Option A — keep the Mac mini

Pros
- No recurring hosting cost, no migration, no new vendor or DPA for hosting.
- Full physical control; Apple Silicon (if applicable [to verify]) is good for local AI.

Cons
- Availability: one power supply, one residential/office link, one machine (SPOF).
- Physical security: desk machine, no access control (checklist S13).
- No firewall/VPN documented; exposure through the box (audit #3).
- Backups on the same disk (audit #1); no 3-2-1 without extra work.
- Both tenants on one host and one DB server (audit #13).
- Annemasse latency, and Annemasse down whenever Réunion's link is down.
- Hard to evidence Art. 32 to a CNIL control or a client audit: no certification to cite.

Can be mitigated without migrating: FileVault, encrypted off-site backups, firewall, VPN, no sleep. **Availability and physical security cannot be fixed on this hardware.**

## 3. Option B — European dedicated server

Pros
- Datacenter power, network and physical access control; no dependency on HQ connectivity.
- One site for both tenants: Annemasse latency drops; Réunion ↔ France latency ≈ 150 ms is acceptable for a web app (audit §5).
- Proper firewall, private network, snapshots, a second location for backups.
- Certifications usable as audit evidence (ISO 27001, HDS where in scope).
- Frees the Mac mini for a better role (AI node, see §7).

Cons
- Recurring cost (small, see §5) and a migration project with a cutover window.
- IaaS, not managed: patching, hardening, backups stay our job.
- Headline price excludes VAT [web]; setup fee on short commitments [web].
- Réunion users get +150 ms versus local.

## 4. GDPR comparison

| Criterion | Mac mini | EU dedicated server |
|---|---|---|
| Location (Art. 44) | France | EU (choose a French datacenter explicitly) |
| Processor contract (Art. 28) | None needed for hosting | DPA with the host to sign and archive in `rgpd/dpas/` |
| Encryption at rest (Art. 32) | Possible (FileVault), off today | Possible (LUKS), on from day one |
| Availability / restore (Art. 32) | Weak, no tested restore | RAID1 + off-site copy + restore test |
| Breach detection (Art. 33) | No monitoring | External uptime, centralised logs possible |
| Physical access (S13) | Office | Datacenter |
| Evidence | None | Provider certifications, DPA |
| US-law exposure (CLOUD Act) | None for hosting | OVHcloud and Scaleway are French groups; assessed as low; the app already sends data to US/non-EU processors (Google, Sentry, ClassMarker, Anthropic — audit #5, #10, #11), a larger exposure than the host |

Decision recorded: the CLOUD Act is not a blocking criterion for the team [team]. SecNumCloud is therefore a "nice to have", not a requirement (see §5.3).

## 5. Market study — OVHcloud vs Scaleway

### 5.1 Offers compared (as provided by the team, prices excl. VAT unless stated)

| | OVHcloud SYS-1 (So you Start / Eco) | Scaleway Pro-4-S (Dedibox) |
|---|---|---|
| CPU | Xeon E-2136, 6c/12t, 3.3–4.5 GHz | Xeon E3-1245v5, 4c/8t, 3.5 GHz |
| CPU benchmark | ~12.9 K [team] | ~8.0 K [team] |
| RAM | 32 GB DDR4 ECC (up to 128 GB; 64 GB ≈ +$11/month) [web] | 32 GB DDR4 [team] |
| Storage | 2×512 GB NVMe soft RAID (up to 2×4 TB) [web] | 3×250 GB SSD [team] |
| Public network | 1 Gbps unmetered in the EU configurator, 500 Mbps private [web] | 300 Mbps (up to 1 Gbps) [team] |
| Price | from $33.20/month [web] | €34.99/month [team] |
| Region choice | Several continents offered — **must pick a French datacenter** | EU |
| SLA | 99.9 % for Eco range [web] | [to verify] |
| Support | Ticket; phone only if bought via OVHcloud [web] | [to verify] |

On raw hardware the SYS-1 wins (more cores, NVMe, RAID1 in two disks, ECC) at a similar price. The Pro-4-S is an older platform.

### 5.2 Certifications relevant to the data we hold (NIR, disability)

| | OVHcloud | Scaleway |
|---|---|---|
| ISO 27001 | [to verify on the exact product] | Yes [web] |
| HDS (health data hosting) | [to verify] | Yes, on a defined product scope (Object/Block Storage, Kapsule…); signed HDS contract needed [web] |
| SecNumCloud | Qualified, **but only on dedicated offers** (Bare Metal Pod, SNC Cloud Platform, vSphere); not on SYS/Eco servers [web] | **Not granted**; qualification in progress [web] |

Important correction to an earlier assumption: **the SYS-1 is not SecNumCloud.** OVH's qualified bare-metal product (Bare Metal Pod) requires an isolated environment of at least 8 servers, a dedicated account and Enterprise support [web] — out of proportion for this application. Comparing SYS-1 to a SecNumCloud offer is comparing different categories.

### 5.3 Is SecNumCloud needed?
Not by the GDPR itself (audit §1.2: "recommended, not mandatory"). It matters if the DPO or a client requires protection from extra-EU laws for the health/disability data. If so: the qualified product list is narrow and expensive, and neither provider's cheap dedicated range qualifies. Compensating control: encrypt NIR and health fields with keys we hold (GDPR_INF_02.2, 02.3) and encrypt backups client-side.

### 5.4 Recommendation
**OVHcloud, SYS-class (or one tier up), French datacenter, 2×NVMe RAID1 + LUKS**, because of hardware per euro and storage layout. Scaleway remains a valid alternative (HDS in scope, ISO 27001 confirmed); choose it if the DPO decides HDS is mandatory and OVH cannot evidence it for this product [to verify].

Conditions before signing:
- OVH: confirm the support/SLA level of the Eco range is acceptable for production HR data; check HDS/ISO 27001 for the chosen product; sign the DPA.
- Off-site backups at a **different** provider (3-2-1), encrypted before leaving the host.

## 6. Sizing — what we know and what we do not

Verified in the repo [repo]:
- Stack: MySQL 8.4, MongoDB 8.2, backend (Node 22 + Chromium for PDFs), nginx, Ollama, otel-collector, Jaeger (`docker-compose.yaml`).
- DB pools: 10 MySQL + 10 Mongo connections. 7 in-process schedulers, 6 hourly/daily and 1 per minute.
- Ollama model `qwen2.5:3b`: 1.8 GB on disk; called on demand (candidate summary, sourcing), 120 s timeout, no queue.
- Local dev data (not production): Mongo `human_ressources` ≈ 28 MiB, Annemasse ≈ 1.6 MiB, MySQL data dir ≈ 100 MB.

**Not known — [to measure] on the Mac mini:** real database size, RAM/CPU per container, peak load, active accounts per tenant. Two scripts now exist for it:
- `scripts/infra-specs.sh` — one-shot snapshot of host and stack.
- `scripts/docker-stats-sampler.sh` (+ launchd job) — samples once a minute; `report` gives averages and peaks. Run it for at least one full working week, including month-end/immersion periods.

Provisional position until data arrives: nothing in the code requires a large machine; 32 GB is the floor; moving to 64 GB is cheap (≈ +$11/month on SYS-1 [web]) and worth it if we keep a CPU fallback for Ollama or want staging on the same host. The audit's EPYC/64 GB/2×4 TB dedicated is oversized for this workload (disk especially). **Final size to be decided on the measurements.**

## 7. Role of the Mac mini after migration
- **Not** a production server (SPOF again; splitting tenants across sites defeats the migration).
- **AI node** (Ollama), recommended if it is Apple Silicon [to verify model]: outbound tunnel (WireGuard/Tailscale) to the server, no port forwarding, Ollama bound to the tunnel interface only, FileVault on, no prompt/log persistence, async/graceful fallback if the node is down, listed in the Art. 30 register.
- Otherwise: dev/standby, wiped securely after cutover.

## 8. Conclusion

1. **Migrate.** The audit's critical findings #1, #2, #3 and the availability/latency problems are structural to the current hosting.
2. **Host:** OVHcloud SYS-class in France (alternative: Scaleway), single site for both tenants, RAID1 + LUKS, firewall deny-by-default, SSH via VPN, Caddy versioned.
3. **SecNumCloud is not required** by the team; compensate with own-key encryption.
4. **Do now, regardless of migration:** FileVault, fix `backup-db.sh` (both tenants, encrypted, off-site), reset Jaeger/OTLP ports, start the stats sampler.
5. **Size on measurements**, not estimates.
6. Update after cutover: `mentions-legales.md` (hosting provider), Art. 30 register, `rgpd/dpas/`, `HOWTODEPLOY.md`, `GDPR_INF_*` issues.

## 9. Open questions about production infrastructure

Measurements (answer with `infra-specs.sh` and the sampler report):
1. Real DB sizes (MySQL, Mongo) per tenant; total disk used and growth rate.
2. Peak and average RAM/CPU per container over a working week.
3. Active accounts per tenant and typical concurrent users.

Mac mini and network:
4. Exact model (chip, RAM) and macOS version — does it run Docker Desktop or another runtime?
5. Who has physical and SSH access? Which ports does the box forward? Is Caddy config backed up anywhere?
6. Is there any uninterrupted-power or secondary-link setup at HQ?

Compliance:
7. Does the DPO treat the disability data as health data requiring HDS hosting?
8. Are Sentry (EU DSN) and DocuSeal (EU endpoint) really EU in production? (audit §4)
9. Did a cloud DB (Atlas/TiDB) ever hold production data? (audit #20)

Project:
10. Acceptable downtime window for the cutover, and the monthly budget ceiling.
11. Is there an existing OVHcloud or Scaleway account/contract?
12. Which domains point to production today (Réunion, Annemasse) and who controls the DNS?

## Sources
- [OVHcloud SecNumCloud-qualified solutions](https://www.ovhcloud.com/en/secnumcloud/) · [Bare Metal Pod](https://www.ovhcloud.com/en/bare-metal/secnumcloud/) · [Nutanix on Bare Metal Pod](https://corporate.ovhcloud.com/en/newsroom/news/nutanix-baremetal-pod-servers-snc/)
- [Scaleway security and compliance](https://www.scaleway.com/en/security-and-compliance/) · [Scaleway SecNumCloud process](https://www.scaleway.com/en/security-and-compliance/secnumcloud/) · [Qovery comparison of SecNumCloud clouds](https://www.qovery.com/blog/numspot-ovhcloud-scaleway-secnumcloud-sovereign-cloud-comparison) · [Qovery HDS list](https://www.qovery.com/blog/hds-certified-platforms-health-data-france)
- [SYS-1 configurator](https://www.kimsufi.com/en/sys/sys-1/) · [So you Start](https://www.soyoustart.com/en/) · [OVHcloud Eco](https://eco.ovhcloud.com/en/)
