import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token, disconnecting...`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });

      client.data.user = payload;
      this.logger.log(`Client ${client.id} authenticated (User: ${payload.sub})`);
    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinPost')
  handleJoinPost(@ConnectedSocket() client: Socket, @MessageBody('postId') postId: string) {
    if (postId) {
      const roomName = `post:${postId}`;
      client.join(roomName);
      this.logger.log(`Client ${client.id} joined room: ${roomName}`);
      return { event: 'joined', data: postId };
    }
  }

  @SubscribeMessage('leavePost')
  handleLeavePost(@ConnectedSocket() client: Socket, @MessageBody('postId') postId: string) {
    if (postId) {
      const roomName = `post:${postId}`;
      client.leave(roomName);
      this.logger.log(`Client ${client.id} left room: ${roomName}`);
      return { event: 'left', data: postId };
    }
  }

  /**
   * Emits optimized post update events to the specific post room.
   */
  emitPostUpdate(postId: string, event: 'postLiked' | 'postUnliked' | 'commentAdded' | 'commentDeleted', data: {
    likesCount: number;
    commentsCount: number;
    likedBy?: { id: string; avatarUrl: string | null }[];
    comment?: any;
    commentId?: string;
  }) {
    const payload = {
      postId,
      likesCount: data.likesCount,
      commentsCount: data.commentsCount,
      likedBy: data.likesCount > 0 ? data.likedBy : undefined,
      comment: data.comment,
      commentId: data.commentId,
    };
    this.logger.log(`Emitting ${event} for post ${postId} to room post:${postId}`);
    this.server.to(`post:${postId}`).emit(event, payload);
  }

  emitReplyAdded(postId: string, parentId: string, data: any) {
    this.server.to(`post:${postId}`).emit('replyAdded', { ...data, parentId });
  }
}
