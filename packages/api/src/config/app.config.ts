import { plainToClass } from 'class-transformer'
import { IsEnum, IsNumber, IsString, IsUrl, Min, validateSync } from 'class-validator'

enum NodeEnv {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development

  @IsNumber()
  @Min(1)
  PORT: number = 4000

  @IsString()
  DATABASE_URL!: string

  @IsString()
  REDIS_URL!: string

  @IsString()
  JWT_ACCESS_SECRET!: string

  @IsString()
  JWT_REFRESH_SECRET!: string

  @IsNumber()
  JWT_ACCESS_TTL: number = 900

  @IsNumber()
  JWT_REFRESH_TTL: number = 604800

  @IsString()
  COOKIE_SECRET!: string

  @IsString()
  CORS_ORIGINS: string = 'http://localhost:3000'
}

export function validateConfig(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  })
  const errors = validateSync(validatedConfig, { skipMissingProperties: false })
  if (errors.length > 0) {
    throw new Error(`Configuration validation error:\n${errors.toString()}`)
  }
  return validatedConfig
}

export const appConfig = () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL || '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL || '604800', 10),
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET,
    publicUrl: process.env.S3_PUBLIC_URL,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  },
})
