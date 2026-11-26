import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ConfigService } from '@nestjs/config'
import { EmailService } from './email.service'
import * as safeFetchModule from '../http/safe-fetch'

describe('EmailService', () => {
  let configService: ConfigService
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  const createService = (configValues: Record<string, string> = {}) => {
    configService = {
      get: vi.fn((key: string, defaultValue?: string) => configValues[key] ?? defaultValue),
    } as unknown as ConfigService

    return new EmailService(configService)
  }

  describe('Console provider', () => {
    it('should log email to console and not call safeFetch', async () => {
      const fetchSpy = vi.spyOn(safeFetchModule, 'safeFetch')
      const service = createService({ EMAIL_PROVIDER: 'console' })

      await service.send({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('Resend provider', () => {
    it('should throw RESEND_API_KEY manquant in production when key is missing', async () => {
      process.env.NODE_ENV = 'production'
      const service = createService({
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: '',
      })

      await expect(
        service.send({
          to: 'user@example.com',
          subject: 'Test Subject',
          html: '<p>Test</p>',
        }),
      ).rejects.toThrow('RESEND_API_KEY manquant')
    })

    it('should fall back to simulated console send in development when key is missing', async () => {
      process.env.NODE_ENV = 'development'
      const fetchSpy = vi.spyOn(safeFetchModule, 'safeFetch')
      const service = createService({
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: '',
      })

      await expect(
        service.send({
          to: 'user@example.com',
          subject: 'Test Subject',
          html: '<p>Test</p>',
          text: 'Test plain text',
        }),
      ).resolves.toBeUndefined()

      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('should send email via Resend API when RESEND_API_KEY is present', async () => {
      process.env.NODE_ENV = 'production'
      const fetchSpy = vi.spyOn(safeFetchModule, 'safeFetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'resend-msg-123' }),
        text: async () => JSON.stringify({ id: 'resend-msg-123' }),
      })

      const service = createService({
        EMAIL_PROVIDER: 'resend',
        EMAIL_FROM: 'noreply@nourplay.app',
        APP_NAME: 'NourPlay',
        RESEND_API_KEY: 're_test_key_123',
      })

      await service.send({
        to: 'recipient@example.com',
        subject: 'Bienvenue',
        html: '<p>Bienvenue sur NourPlay</p>',
        text: 'Bienvenue sur NourPlay',
      })

      expect(fetchSpy).toHaveBeenCalledWith('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer re_test_key_123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'NourPlay <noreply@nourplay.app>',
          to: ['recipient@example.com'],
          subject: 'Bienvenue',
          html: '<p>Bienvenue sur NourPlay</p>',
          text: 'Bienvenue sur NourPlay',
        }),
      })
    })

    it('should keep custom formatted from address as is', async () => {
      process.env.NODE_ENV = 'production'
      const fetchSpy = vi.spyOn(safeFetchModule, 'safeFetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'msg-456' }),
        text: async () => '',
      })

      const service = createService({
        EMAIL_PROVIDER: 'resend',
        EMAIL_FROM: 'Custom Name <custom@nourplay.app>',
        RESEND_API_KEY: 're_123',
      })

      await service.send({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      })

      const callArgs = fetchSpy.mock.calls[0]
      const body = JSON.parse(callArgs[1]?.body as string)
      expect(body.from).toBe('Custom Name <custom@nourplay.app>')
    })

    it('should retry and succeed via onboarding@resend.dev when custom domain returns 403', async () => {
      process.env.NODE_ENV = 'production'
      const fetchSpy = vi.spyOn(safeFetchModule, 'safeFetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({ message: 'Domain not verified' }),
          text: async () => '{"message":"Domain not verified"}',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'fallback-msg-789' }),
          text: async () => '{"id":"fallback-msg-789"}',
        })

      const service = createService({
        EMAIL_PROVIDER: 'resend',
        EMAIL_FROM: 'noreply@nour-play.app',
        RESEND_API_KEY: 're_test_key_abc',
      })

      await service.send({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      })

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      const secondCallArgs = fetchSpy.mock.calls[1]
      const secondBody = JSON.parse(secondCallArgs[1]?.body as string)
      expect(secondBody.from).toBe('NourPlay <onboarding@resend.dev>')
    })

    it('should throw an error with response details when Resend returns non-200', async () => {
      process.env.NODE_ENV = 'production'
      vi.spyOn(safeFetchModule, 'safeFetch').mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Domain not verified' }),
        text: async () => '{"message":"Domain not verified"}',
      })

      const service = createService({
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_test_key',
      })

      await expect(
        service.send({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Hi</p>',
        }),
      ).rejects.toThrow('Resend API error: {"message":"Domain not verified"}')
    })

    it('should handle network fetch errors gracefully', async () => {
      process.env.NODE_ENV = 'production'
      vi.spyOn(safeFetchModule, 'safeFetch').mockRejectedValue(new Error('Network offline'))

      const service = createService({
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_test_key',
      })

      await expect(
        service.send({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Hi</p>',
        }),
      ).rejects.toThrow('Resend API error: Network offline')
    })

    it('should throw when an unsupported email provider is configured', async () => {
      const service = createService({ EMAIL_PROVIDER: 'sendgrid' })

      await expect(
        service.send({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Hi</p>',
        }),
      ).rejects.toThrow('Email provider "sendgrid" non supporté')
    })
  })

  describe('Email templates and methods', () => {
    it('sendVerificationEmail should build link and send with localized subject', async () => {
      const service = createService({
        EMAIL_PROVIDER: 'console',
        APP_URL: 'https://nourplay.app',
      })
      const sendSpy = vi.spyOn(service, 'send').mockResolvedValue(undefined)

      await service.sendVerificationEmail('test@example.com', 'tok-abc', 'fr')

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Vérifiez votre adresse email — NourPlay',
          text: 'https://nourplay.app/fr/auth/verify-email?token=tok-abc',
        }),
      )
    })

    it('sendPasswordResetEmail should send reset link', async () => {
      const service = createService({
        EMAIL_PROVIDER: 'console',
        APP_URL: 'https://nourplay.app',
      })
      const sendSpy = vi.spyOn(service, 'send').mockResolvedValue(undefined)

      await service.sendPasswordResetEmail('test@example.com', 'reset-tok', 'en')

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Reset your password — NourPlay',
          text: 'https://nourplay.app/en/auth/reset-password?token=reset-tok',
        }),
      )
    })

    it('sendMagicLinkEmail should send magic link', async () => {
      const service = createService({
        EMAIL_PROVIDER: 'console',
        APP_URL: 'https://nourplay.app',
      })
      const sendSpy = vi.spyOn(service, 'send').mockResolvedValue(undefined)

      await service.sendMagicLinkEmail('test@example.com', 'magic-tok', 'fr')

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Votre lien de connexion NourPlay',
          text: 'https://nourplay.app/fr/auth/magic-link/verify?token=magic-tok',
        }),
      )
    })

    it('sendVideoReviewEmail should support approve and reject', async () => {
      const service = createService({ EMAIL_PROVIDER: 'console' })
      const sendSpy = vi.spyOn(service, 'send').mockResolvedValue(undefined)

      await service.sendVideoReviewEmail('creator@example.com', 'Video 1', 'approve', undefined, 'fr')
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'creator@example.com',
          subject: 'Votre vidéo a été approuvée — NourPlay',
        }),
      )

      await service.sendVideoReviewEmail('creator@example.com', 'Video 2', 'reject', 'Contenu inadapté', 'fr')
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'creator@example.com',
          subject: 'Votre vidéo a été refusée — NourPlay',
        }),
      )
    })
  })
})
