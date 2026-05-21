export { PrismaClient, Prisma } from '../generated/client'

// Enums exportés comme valeurs (pas `export type`) — nécessaire à l'exécution
export {
  UserRole,
  AgeGroup,
  PlaylistVisibility,
  PlaylistAccessRole,
  VideoValidationStatus,
  AgeRating,
  ConsentType,
  BlockType,
  GdprRequestType,
  GdprRequestStatus,
} from '../generated/client'

// Types Prisma (models)
export type {
  User,
  ChildProfile,
  RefreshToken,
  VideoSource,
  Video,
  Tag,
  VideoTag,
  Playlist,
  PlaylistVideo,
  PlaylistAccess,
  Category,
  WatchHistory,
  UserBlock,
  ConsentRecord,
  GdprRequest,
  VideoReport,
  Notification,
  AuditLog,
} from '../generated/client'
