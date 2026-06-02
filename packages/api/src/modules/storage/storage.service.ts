import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  S3Client,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

@Injectable()
export class StorageService implements OnModuleInit {
  private client!: S3Client
  private bucket!: string
  private publicUrl!: string
  private enabled = false

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const s3 = this.config.get('s3') as {
      endpoint?: string
      accessKeyId?: string
      secretAccessKey?: string
      bucket?: string
      publicUrl?: string
    }

    if (s3.accessKeyId && s3.secretAccessKey && s3.bucket) {
      this.client = new S3Client({
        endpoint: s3.endpoint,
        region: 'auto',
        credentials: {
          accessKeyId: s3.accessKeyId,
          secretAccessKey: s3.secretAccessKey,
        },
        // Required for Cloudflare R2
        forcePathStyle: false,
      })
      this.bucket = s3.bucket
      this.publicUrl = s3.publicUrl ?? ''
      this.enabled = true
    }
  }

  // ── Presigned upload URL ──────────────────────────────────────

  async getPresignedUploadUrl(folder: string, contentType: string, sizeBytes: number) {
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      throw new BadRequestException(`Type de fichier non autorisé: ${contentType}`)
    }
    if (sizeBytes > MAX_SIZE_BYTES) {
      throw new BadRequestException(`Fichier trop grand (max ${MAX_SIZE_BYTES / 1024 / 1024} MB)`)
    }

    if (!this.enabled) {
      // Dev fallback: return a fake presigned URL so the UI can be tested without R2
      const key = `${folder}/${randomUUID()}.${contentType.split('/')[1]}`
      return {
        uploadUrl: `http://localhost:4000/storage/dev-noop/${key}`,
        key,
        publicUrl: `http://localhost:3000/_avatars/${key}`,
      }
    }

    const key = `${folder}/${randomUUID()}.${contentType.split('/')[1]}`

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    })

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 })

    return { uploadUrl, key, publicUrl: this.getPublicUrl(key) }
  }

  // ── Public URL from key ───────────────────────────────────────

  getPublicUrl(key: string): string {
    if (!this.enabled || !this.publicUrl) return ''
    return `${this.publicUrl}/${key}`
  }

  // ── Presigned download URL (private objects) ──────────────────

  async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.enabled) return ''
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.client, command, { expiresIn })
  }

  // ── Delete ────────────────────────────────────────────────────

  async deleteObject(key: string): Promise<void> {
    if (!this.enabled || !key) return
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  // ── Health check ──────────────────────────────────────────────

  async isHealthy(): Promise<boolean> {
    if (!this.enabled) return true
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
      return true
    } catch {
      return false
    }
  }
}
