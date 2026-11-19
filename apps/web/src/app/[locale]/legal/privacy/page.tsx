import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de Confidentialité',
  description: 'Politique de confidentialité et protection des données personnelles de NourPlay',
}

export default function PrivacyPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Politique de Confidentialité</h1>
      <p className="text-xs text-gray-500 mb-6">Version 1.0 — Conformité RGPD & Protection des données des mineurs</p>

      <section className="space-y-6 text-sm text-gray-700 leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Responsable de traitement</h2>
          <p>
            NourPlay est édité par NourPlay SAS. Nous nous engageons à protéger la vie privée des utilisateurs et en particulier celle des mineurs.
          </p>
          <p className="mt-1">Contact DPO : <a href="mailto:dpo@nourplay.app" className="text-indigo-600 underline">dpo@nourplay.app</a></p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Données collectées</h2>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong>Adultes :</strong> Adresse email, mot de passe hashé (Argon2id), langue préférée.</li>
            <li><strong>Profils enfants :</strong> Prénom ou pseudonyme, tranche d&apos;âge, code PIN parental (hashé).</li>
            <li><strong>Minimisation :</strong> Aucune date de naissance complète ni nom de famille d&apos;enfant n&apos;est jamais collecté.</li>
            <li><strong>Aucune géolocalisation</strong> et aucun pistage publicitaire ou profiling tiers.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Cookies et traceurs</h2>
          <p>
            NourPlay utilise exclusivement des cookies fonctionnels strictement nécessaires au maintien de la session sécurisée (<code>refresh_token</code>) et à la langue de navigation. Aucun cookie publicitaire ou traceur tiers n&apos;est utilisé.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Vos droits (RGPD)</h2>
          <p>
            Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, de suppression (droit à l&apos;oubli) et d&apos;exportation de l&apos;ensemble de vos données directement depuis votre espace parent ou sur simple demande à <a href="mailto:dpo@nourplay.app" className="text-indigo-600 underline">dpo@nourplay.app</a>.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Hébergement et sécurité</h2>
          <p>
            Les données sont stockées au sein de l&apos;Union Européenne (Allemagne / France) avec chiffrement en transit (TLS 1.3) et au repos (AES-256).
          </p>
        </div>
      </section>
    </div>
  )
}
