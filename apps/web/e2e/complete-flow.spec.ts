import { test, expect, Page } from '@playwright/test'

/**
 * Configure les mocks de l'API REST NourPlay pour permettre l'exécution
 * de la suite E2E complète de manière déterministe et isolée.
 */
async function setupApiMocks(page: Page) {
  // 1. Authentification & Refresh
  await page.route('**/api/v1/auth/login', async route => {
    const postData = route.request().postDataJSON()
    if (postData?.email === 'parent@nourplay.com' && postData?.password === 'SuperSecret123!') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'mock-jwt-parent-token-12345',
          refreshToken: 'mock-refresh-token-12345',
          requiresTwoFactor: false,
        }),
      })
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Identifiants incorrects' }),
      })
    }
  })

  await page.route('**/api/v1/auth/refresh', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'mock-jwt-parent-token-12345',
        refreshToken: 'mock-refresh-token-12345',
      }),
    })
  })

  // 2. Profil utilisateur connecté
  await page.route('**/api/v1/users/me', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'parent-user-id',
        email: 'parent@nourplay.com',
        role: 'PARENT',
        status: 'ACTIVE',
      }),
    })
  })

  // 3. Profils enfants de l'utilisateur
  await page.route('**/api/v1/users/me/profiles', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'child-profile-lina',
            displayName: 'Lina',
            avatarKey: 'avatar-1',
            ageGroup: 'AGE_4_6',
            sessionLimitMin: 30,
            dailyLimitMin: 60,
            hasPin: true,
            viewingSchedule: null,
          },
        ]),
      })
    } else {
      await route.continue()
    }
  })

  // 4. Vérification du code PIN enfant
  await page.route('**/api/v1/users/me/profiles/*/pin/verify', async route => {
    const postData = route.request().postDataJSON()
    if (postData?.pin === '1234') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(true),
      })
    } else {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'PIN incorrect' }),
      })
    }
  })

  // 5. Temps quotidien consommé
  await page.route('**/api/v1/users/me/profiles/*/daily-watch-time', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ watchedSec: 300 }),
    })
  })

  // 6. Playlists enfant
  await page.route('**/api/v1/playlists', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'playlist-comptines',
            name: 'Comptines et Chansons',
            description: 'Les plus belles chansons pour enfants',
            visibility: 'PUBLIC',
            scheduledPublishAt: null,
            _count: { playlistVideos: 1 },
          },
        ]),
      })
    } else {
      await route.continue()
    }
  })

  // 7. Détail d'une playlist
  await page.route('**/api/v1/playlists/playlist-comptines', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'playlist-comptines',
        name: 'Comptines et Chansons',
        description: 'Les plus belles chansons pour enfants',
        visibility: 'PUBLIC',
        targetAgeGroup: ['AGE_4_6'],
        languages: ['fr'],
        scheduledPublishAt: null,
        createdAt: new Date().toISOString(),
        playlistVideos: [
          {
            position: 1,
            video: {
              id: 'vid-petit-escargot',
              title: 'Petit escargot porte sur son dos',
              thumbnailUrl: null,
              embedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              durationSec: 120,
              ageRating: 'ALL',
            },
          },
        ],
      }),
    })
  })

  // 8. Favoris et Reprise de lecture (In-progress)
  await page.route('**/api/v1/users/me/profiles/*/favorites*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/v1/users/me/profiles/*/in-progress', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // 9. Détail d'une vidéo individuelle
  await page.route('**/api/v1/videos/vid-petit-escargot', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'vid-petit-escargot',
        title: 'Petit escargot porte sur son dos',
        embedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationSec: 120,
        ageRating: 'ALL',
        sourceName: 'YouTube',
      }),
    })
  })

  // 10. Vidéos similaires et notation
  await page.route('**/api/v1/videos/vid-petit-escargot/similar', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/v1/videos/*/rating*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rating: null }),
    })
  })

  // 11. Déverrouillage mot de passe mode parent
  await page.route('**/api/v1/auth/verify-parent-password', async route => {
    const postData = route.request().postDataJSON()
    if (postData?.password === 'SuperSecret123!') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true }),
      })
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Mot de passe incorrect' }),
      })
    }
  })
}

test.describe('NourPlay - Parcours E2E complet', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
  })

  test('Écran de connexion : affiche l’identité visuelle NourPlay et les champs requis', async ({ page }) => {
    await page.goto('/auth/login')

    // Vérification de la présence du logo NourPlay
    await expect(page.locator('text=NourPlay').first()).toBeVisible({ timeout: 10_000 })

    // Présence des champs de saisie
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitBtn = page.locator('button[type="submit"]')

    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    await expect(submitBtn).toBeVisible()
  })

  test('Flux complet : Connexion -> Profil enfant -> PIN -> Compteur -> Lecteur vidéo -> Déverrouillage Parent', async ({ page }) => {
    // 1. Étape Connexion
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'parent@nourplay.com')
    await page.fill('input[type="password"]', 'SuperSecret123!')
    await page.click('button[type="submit"]')

    // 2. Étape Sélecteur de profil enfant
    await page.waitForURL(/\/child$/, { timeout: 12_000 })
    await expect(page.locator('h1:has-text("Qui regarde ?")')).toBeVisible({ timeout: 10_000 })

    // Clic sur le profil "Lina"
    const linaProfileBtn = page.locator('button:has-text("Lina")')
    await expect(linaProfileBtn).toBeVisible({ timeout: 8_000 })
    await linaProfileBtn.click()

    // 3. Étape Saisie du code PIN
    const pinModal = page.locator('.fixed:has-text("Lina")')
    await expect(pinModal).toBeVisible({ timeout: 5_000 })

    const pinInput = pinModal.locator('input[type="password"]')
    await expect(pinInput).toBeVisible()
    await pinInput.fill('1234')
    await pinModal.locator('button[type="submit"]:has-text("Valider")').click()

    // 4. Étape Interface Enfant & Compteur de temps
    await page.waitForURL(/\/child\/playlists/, { timeout: 12_000 })

    // Vérifier la présence du compteur de temps en haut de la page
    const countdownTimer = page.locator('.font-mono').first()
    await expect(countdownTimer).toBeVisible({ timeout: 8_000 })

    // La playlist doit être visible
    await expect(page.locator('text=Comptines et Chansons').first()).toBeVisible({ timeout: 8_000 })

    // 5. Étape Lecteur Vidéo
    // Navigation vers la vidéo
    await page.goto('/child/watch/vid-petit-escargot?playlist=playlist-comptines')
    await page.waitForURL(/\/child\/watch\/vid-petit-escargot/, { timeout: 10_000 })

    // Le titre de la vidéo et l'iframe du lecteur doivent être présents
    await expect(page.locator('text=Petit escargot porte sur son dos').first()).toBeVisible({ timeout: 8_000 })
    const videoIframe = page.locator('iframe')
    await expect(videoIframe).toBeVisible({ timeout: 8_000 })

    // Le compteur reste visible pendant le visionnage
    await expect(countdownTimer).toBeVisible()

    // 6. Étape Déverrouillage Mode Parent
    const parentModeBtn = page.getByRole('button', { name: /Mode Parent/i })
    await expect(parentModeBtn).toBeVisible()
    await parentModeBtn.click()

    // La modale de déverrouillage parental apparaît
    const unlockModal = page.locator('[role="dialog"]')
    await expect(unlockModal).toBeVisible({ timeout: 5_000 })
    await expect(unlockModal.locator('#parent-unlock-title')).toContainText('Mode Parent')

    // Test mauvais mot de passe
    const passwordInput = unlockModal.locator('input[type="password"]')
    await passwordInput.fill('mauvais_mot_de_passe')
    await unlockModal.getByRole('button', { name: 'Déverrouiller' }).click()
    await expect(unlockModal.locator('text=Mot de passe incorrect')).toBeVisible({ timeout: 5_000 })

    // Saisie du mot de passe correct
    await passwordInput.fill('SuperSecret123!')
    await unlockModal.getByRole('button', { name: 'Déverrouiller' }).click()

    // Redirection vers le tableau de bord parent
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('Persistance de la session enfant : le rechargement conserve le mode enfant sans redemander le PIN', async ({ page }) => {
    // Connexion initiale
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'parent@nourplay.com')
    await page.fill('input[type="password"]', 'SuperSecret123!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/child$/, { timeout: 12_000 })

    // Injection directe de session enfant dans localStorage
    await page.evaluate(() => {
      const session = {
        profileId: 'child-profile-lina',
        displayName: 'Lina',
        ageGroup: 'AGE_4_6',
        dailyLimitMin: 60,
        sessionLimitMin: 30,
        viewingSchedule: null,
        activatedAt: Date.now(),
      }
      localStorage.setItem('nourplay_child_session', JSON.stringify(session))
      sessionStorage.setItem('nourplay_child_session', JSON.stringify(session))
    })

    // Navigation vers les playlists
    await page.goto('/child/playlists')
    await expect(page).toHaveURL(/\/child\/playlists/)

    // Rechargement complet de la page (F5)
    await page.reload()

    // L'utilisateur reste sur l'interface enfant et le compteur est immédiatement actif
    await expect(page).toHaveURL(/\/child\/playlists/)
    const countdownTimer = page.locator('.font-mono').first()
    await expect(countdownTimer).toBeVisible({ timeout: 8_000 })
  })

  test('Sécurité : Un utilisateur non connecté est redirigé vers /auth/login s’il tente d’accéder à l’interface enfant', async ({ page }) => {
    // Simuler l'absence de session (refresh renvoie 401)
    await page.route('**/api/v1/auth/refresh', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Non authentifié' }),
      })
    })

    await page.goto('/child/playlists')
    await page.waitForURL(/\/auth\/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
