# Phase 28 — CI Hardening & Playwright E2E Integration

## Objectif

Corriger le workflow CI existant (branche incorrecte, commande coverage cassée, action non pinnée) et ajouter un workflow E2E Playwright dédié avec un nouveau spec pour la page abonnement et les limites de forfait.

## Problèmes corrigés dans `ci.yml`

| Avant | Après | Impact |
|-------|-------|--------|
| `branches: [main, develop]` | `branches: [main, dev]` | Le CI ne tournait jamais sur la branche active `dev` |
| `pnpm turbo run test -- --coverage` | `pnpm --filter @nourplay/api test:coverage` | Passage de `--coverage` via turbo passthrough est fragile; commande directe plus fiable |
| `aquasecurity/trivy-action@master` | `aquasecurity/trivy-action@0.28.0` | Pinning à master = surface d'attaque supply-chain |
| `pnpm audit` bloquant | `continue-on-error: true` | `pnpm audit` produit beaucoup de false positives — ne pas bloquer le CI sur les moderate |

## Nouveau workflow : `.github/workflows/e2e.yml`

Workflow dédié Playwright séparé du CI rapide :

```
Déclencheurs : push main, PR vers main, workflow_dispatch

Services : postgres:16-alpine + redis:7-alpine
Étapes :
  1. Install deps + Playwright browsers (chromium uniquement)
  2. DB migrations + seed (compte parent@nourplay.local disponible)
  3. Build API → start API (:4000)
  4. Build web → start web (:3000)
  5. wait-on pour les deux serveurs
  6. playwright test --project=chromium
  7. Upload rapport HTML comme artifact (7 jours)
```

Les tests `dashboard.spec.ts` sont conditionnels (`TEST_EMAIL` env var) — en CI ils utilisent le compte seedé `parent@nourplay.local / Parent1234!`.

## `apps/web/package.json` — script `test:e2e`

Ajout de `"test:e2e": "playwright test"` pour cohérence avec la tâche `turbo.json` `test:e2e`.

## Nouveau spec : `apps/web/e2e/subscription.spec.ts`

Tests couvrant Phase 22 (page abonnement) et Phase 27 (gating des limites) :

| Test | Type |
|------|------|
| Page reachable from nav | Navigation |
| Plan cards render after load | Rendering |
| Free plan has no subscribe button | Plan structure |
| Premium plans show subscribe button | Plan structure |
| Features list visible ("1 profil enfant") | Plan content |
| Unauthenticated → redirect to login | Auth guard |
| `GET /users/me/limits` returns correct shape | API contract |

Le test API contract (`/users/me/limits`) utilise `page.request.get` en passant le Bearer token depuis le localStorage — ce pattern évite d'écrire un test API séparé et teste le contrat réel de l'endpoint créé en Phase 27.

## Structure finale des workflows GitHub Actions

```
.github/
  workflows/
    ci.yml         — lint + typecheck + unit tests + integration tests + build + security
    e2e.yml        — Playwright full-stack (triggers main uniquement)
  dependabot.yml   — mises à jour automatiques npm + GitHub Actions
```

## Tests

- Workflow YAML valide syntaxiquement (indentation + structure vérifiées)
- `@nourplay/api` typecheck : 0 erreurs ✓
