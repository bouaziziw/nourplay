import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../common/prisma/prisma.service'

interface RoomState {
  hostId: string
  videoIndex: number
  participants: Map<string, { userId: string; displayName: string; socketId: string }>
}

interface SocketMeta {
  userId: string
  displayName: string
  code: string
}

@WebSocketGateway({ namespace: '/watch', cors: { origin: '*' } })
export class WatchPartyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly rooms = new Map<string, RoomState>()
  private readonly socketMeta = new Map<string, SocketMeta>()

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined
    if (!token) {
      client.disconnect()
      return
    }
    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(token)
      client.data.userId = payload.sub
      client.data.email = payload.email
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    const meta = this.socketMeta.get(client.id)
    if (!meta) return
    this.socketMeta.delete(client.id)

    const room = this.rooms.get(meta.code)
    if (!room) return

    room.participants.delete(meta.userId)
    this.server.to(meta.code).emit('participant-left', { userId: meta.userId })

    if (room.hostId === meta.userId) {
      this.server.to(meta.code).emit('host-left', {})
      this.rooms.delete(meta.code)
    }
  }

  @SubscribeMessage('join')
  async handleJoin(client: Socket, payload: { code: string; displayName: string }) {
    const userId = client.data.userId as string | undefined
    if (!userId) { client.disconnect(); return }

    const code = (payload.code ?? '').toUpperCase()
    const party = await this.prisma.watchParty.findUnique({
      where: { code },
      include: {
        playlist: {
          include: {
            playlistVideos: {
              orderBy: { position: 'asc' },
              include: {
                video: {
                  select: {
                    id: true,
                    title: true,
                    thumbnailUrl: true,
                    durationSec: true,
                    embedUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!party || party.expiresAt < new Date()) {
      client.emit('error', { message: 'Salle introuvable ou expirée' })
      return
    }

    let room = this.rooms.get(code)
    if (!room) {
      room = { hostId: party.hostId, videoIndex: 0, participants: new Map() }
      this.rooms.set(code, room)
    }

    const displayName = (payload.displayName ?? '').trim() || (client.data.email as string) || 'Anonyme'
    room.participants.set(userId, { userId, displayName, socketId: client.id })
    this.socketMeta.set(client.id, { userId, displayName, code })
    await client.join(code)

    client.emit('joined', {
      isHost: userId === room.hostId,
      videoIndex: room.videoIndex,
      participants: Array.from(room.participants.values()).map(p => ({
        userId: p.userId,
        displayName: p.displayName,
      })),
      playlist: {
        id: party.playlist.id,
        name: party.playlist.name,
        videos: party.playlist.playlistVideos.map((pv: { video: unknown }) => pv.video),
      },
    })

    client.to(code).emit('participant-joined', { userId, displayName })
  }

  @SubscribeMessage('change-video')
  handleChangeVideo(client: Socket, { videoIndex }: { videoIndex: number }) {
    const meta = this.socketMeta.get(client.id)
    if (!meta) return
    const room = this.rooms.get(meta.code)
    if (!room || room.hostId !== meta.userId) return
    if (typeof videoIndex !== 'number' || videoIndex < 0) return

    room.videoIndex = videoIndex
    this.server.to(meta.code).emit('video-changed', { videoIndex })
  }

  @SubscribeMessage('chat')
  handleChat(client: Socket, { message }: { message: string }) {
    const meta = this.socketMeta.get(client.id)
    if (!meta) return
    const trimmed = (message ?? '').trim().slice(0, 300)
    if (!trimmed) return
    this.server.to(meta.code).emit('chat', {
      userId: meta.userId,
      displayName: meta.displayName,
      message: trimmed,
      ts: Date.now(),
    })
  }
}
