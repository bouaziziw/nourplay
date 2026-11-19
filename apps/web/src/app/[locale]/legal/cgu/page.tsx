import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conditions Générales d\'Utilisation (CGU)',
  description: 'Conditions Générales d\'Utilisation de la plateforme NourPlay',
}

export default function CguPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Conditions Générales d&apos;Utilisation (CGU)</h1>
      <p className="text-xs text-gray-500 mb-6">Version 1.0 — Applicable à tous les utilisateurs du service NourPlay</p>

      <section className="space-y-6 text-sm text-gray-700 leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Objet du service</h2>
          <p>
            NourPlay est une plateforme de curation vidéo privée et sécurisée destinée aux parents et enseignants. 
            Elle permet aux adultes de sélectionner, d&apos;organiser en playlists et de diffuser des vidéos éducatives adaptées aux enfants, 
            dans un environnement contrôlé, sans publicité, sans algorithme de recommandation et sans commentaires extérieurs.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Inscription et profils</h2>
          <p>
            L&apos;inscription est strictement réservée aux personnes majeures (parents, tuteurs légaux, éducateurs). 
            Les enfants n&apos;ont pas de compte propre : ils disposent uniquement de profils rattachés au compte adulte superviseur, protégés par code PIN parental.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Intégration des vidéos et respect des droits</h2>
          <p>
            NourPlay n&apos;héberge, ne télécharge et ne stocke aucun fichier vidéo tiers. 
            Les vidéos sont lues exclusivement via les lecteurs officiels embarqués (embed iframe) fournis par YouTube, Vimeo et Dailymotion, conformément à leurs conditions d&apos;utilisation respectives.
          </p>
          <p className="mt-2">
            Toute vidéo ajoutée est contrôlée afin de s&apos;assurer que son intégration externe est formellement autorisée par la plateforme source.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Modération et sécurité des contenus</h2>
          <p>
            Chaque contenu soumis passe par une modération par intelligence artificielle ainsi qu&apos;une vérification humaine avant d&apos;être validé. 
            Les utilisateurs disposent en outre d&apos;un outil de signalement immédiat permettant de masquer et de réévaluer tout contenu inapproprié.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Responsabilité et engagement de l&apos;utilisateur</h2>
          <p>
            L&apos;utilisateur s&apos;engage à ne pas tenter de contourner les restrictions d&apos;accès, à préserver la confidentialité de ses identifiants et à utiliser le service dans le respect des mineurs et des lois en vigueur.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Contact</h2>
          <p>
            Pour toute question concernant les présentes conditions, contactez : <a href="mailto:contact@nourplay.app" className="text-indigo-600 underline">contact@nourplay.app</a>.
          </p>
        </div>
      </section>
    </div>
  )
}
