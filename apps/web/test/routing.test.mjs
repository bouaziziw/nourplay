import assert from 'node:assert/strict'
import { test } from 'node:test'

test('external rewrites preserve the API and admin paths', async () => {
  process.env.API_PROXY_ORIGIN = 'https://api-origin.example'
  process.env.ADMIN_PROXY_ORIGIN = 'https://admin-origin.example'
  const { default: config } = await import('../next.config.mjs?proxy')
  const rewrites = await config.rewrites()
  assert.deepEqual(rewrites.beforeFiles, [
    { source: '/api/:path*', destination: 'https://api-origin.example/api/:path*' },
    { source: '/admin/:path*', destination: 'https://admin-origin.example/admin/:path*' },
  ])
})

test('local development needs no proxy configuration', async () => {
  delete process.env.API_PROXY_ORIGIN
  delete process.env.ADMIN_PROXY_ORIGIN
  const { default: config } = await import('../next.config.mjs?local')
  assert.deepEqual(await config.rewrites(), [])
})

test('partial and malformed proxy configuration fails at build time', async () => {
  process.env.API_PROXY_ORIGIN = 'https://api-origin.example'
  delete process.env.ADMIN_PROXY_ORIGIN
  await assert.rejects(import('../next.config.mjs?partial'), /configured together/)
  process.env.ADMIN_PROXY_ORIGIN = 'https://admin-origin.example/admin'
  await assert.rejects(import('../next.config.mjs?invalid'), /HTTP\(S\) origins/)
  delete process.env.API_PROXY_ORIGIN
  delete process.env.ADMIN_PROXY_ORIGIN
})

test('admin base path is opt-in and rejects unsupported values', async () => {
  delete process.env.ADMIN_BASE_PATH
  const local = await import('../../admin/next.config.mjs?local')
  assert.equal(local.default.basePath, '')
  process.env.ADMIN_BASE_PATH = '/admin'
  const deployed = await import('../../admin/next.config.mjs?deployed')
  assert.equal(deployed.default.basePath, '/admin')
  assert.deepEqual(await deployed.default.redirects(), [
    { source: '/', destination: '/dashboard', permanent: false },
  ])
  process.env.ADMIN_BASE_PATH = '/other'
  await assert.rejects(import('../../admin/next.config.mjs?invalid'), /ADMIN_BASE_PATH/)
  delete process.env.ADMIN_BASE_PATH
})
