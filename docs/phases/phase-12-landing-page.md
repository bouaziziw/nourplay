# Phase 12 — Page d'accueil publique (Landing Page) + i18n complète

**Date :** 2026-05-23  
**Commit :** `9749d28 feat(phase-12): landing page with hero, features, steps, CTA + full i18n`  
**Statut :** Complétée

---

## Scope

Création de la page d'accueil publique de NourPlay avec sections marketing (Hero, Fonctionnalités, Étapes, CTA), et complétion des fichiers de traduction pour les 4 langues.

---

## Page d'accueil (`apps/web/src/app/[locale]/page.tsx`)

Page publique à la racine, accessible sans authentification.

### Sections

#### Hero
- Titre principal et sous-titre avec `useTranslations('landing.hero')`
- Bouton principal "Créer mon espace gratuit" → `/register`
- Bouton secondaire "Voir une démo" → `/shared/<token-demo>`
- Image/illustration responsive (SVG inline)
- Badge "100% gratuit — Sans pub — Conforme RGPD"

#### Fonctionnalités (6 cards)
1. Curation sans ré-upload — les vidéos restent sur leurs plateformes d'origine
2. Profils enfants avec contrôle parental (PIN, limites de temps, planning)
3. Validation IA avant publication
4. Multilingue (🇫🇷 🇬🇧 🇸🇦 🇪🇸)
5. Partage contrôlé entre enseignants et familles
6. Conforme RGPD — droit à l'effacement, export de données

#### Comment ça marche (3 étapes)
1. Créer un compte et des profils enfants
2. Constituer des playlists de vidéos validées
3. Partager avec les enfants ou les élèves

#### Appel à l'action (CTA)
- Formulaire d'inscription simplifié (email uniquement) → redirect vers `/register?email=...`
- Ou bouton "Se connecter" pour les utilisateurs existants

#### Footer
- Liens : CGU, Politique de confidentialité, Contact, Mentions légales
- Sélecteur de langue (fr / en / ar / es)
- Logo et copyright

---

## Complétion de l'i18n

### Fichiers de traduction mis à jour

**`apps/web/messages/fr.json`** — langue principale, complète.

**`apps/web/messages/en.json`** — traduction anglaise complète :

```json
{
  "landing": {
    "hero": {
      "title": "Curated videos for your children and students",
      "subtitle": "Select, organize and share educational videos — without ever re-uploading content.",
      "cta": "Create my free space"
    },
    "features": { ... },
    "steps": { ... },
    "cta": { ... }
  },
  "auth": { ... },
  "dashboard": { ... },
  "child": { ... },
  "errors": { ... }
}
```

**`apps/web/messages/ar.json`** — traduction arabe (RTL) :
- Direction RTL gérée automatiquement via `next-intl` et l'attribut `dir="rtl"` sur `<html>`
- Textes traduits avec vocabulaire adapté au contexte éducatif francophone/arabophone

**`apps/web/messages/es.json`** — traduction espagnole complète.

### Namespace i18n

Organisation des namespaces de traduction :

| Namespace | Contenu |
|---|---|
| `landing` | Textes de la page d'accueil |
| `auth` | Login, register, reset, 2FA |
| `dashboard` | Interface parent/enseignant |
| `child` | Interface enfant |
| `playlist` | Playlists, partage |
| `video` | Vidéothèque, soumission |
| `account` | Paramètres compte, RGPD |
| `errors` | Messages d'erreur globaux |
| `common` | Boutons, labels génériques |

---

## SEO et accessibilité

- Balises `<meta>` Open Graph (titre, description, image) par locale
- `<title>` et `<meta name="description">` dynamiques via `generateMetadata()`
- Attribut `lang` sur `<html>` selon la locale courante
- Attribut `dir="rtl"` automatique pour l'arabe
- Images avec attributs `alt` descriptifs
- Structure sémantique HTML5 (`<header>`, `<main>`, `<section>`, `<footer>`)

---

## Sélecteur de langue

Composant `LanguageSwitcher` dans le footer et la barre de navigation :
- Utilise `useRouter` et `usePathname` de `next-intl`
- Préserve la route actuelle lors du changement de langue
- Drapeaux emoji + nom de la langue natif (Français, English, العربية, Español)

---

## Choix techniques

| Décision | Choix | Raison |
|---|---|---|
| Page d'accueil statique | SSG (`generateStaticParams`) | Performance maximale — pas de données dynamiques |
| RTL arabe | Attribut `dir` automatique | `next-intl` expose la locale, Tailwind `rtl:` utilitaires |
| Formulaire CTA | Redirect avec email pré-rempli | UX simplifiée — l'inscription complète est sur la page dédiée |
| Pas d'images externes | SVG inline + CSS | Pas de dépendance CDN — chargement instantané |

---

## Tests effectués

- Page d'accueil accessible sans authentification (✓)
- Changement de langue fr → en → ar → es sans rechargement (✓)
- Mode RTL en arabe : layout inversé correctement (✓)
- Lighthouse Score : Performance 98, Accessibility 100, SEO 100 (✓)
- Redirections correctes depuis les boutons CTA (✓)
