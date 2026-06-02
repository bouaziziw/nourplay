import {
  Controller, Get, Post, Body, Headers, RawBodyRequest,
  Req, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import type { Request } from 'express'
import { Throttle, SkipThrottle } from '@nestjs/throttler'
import { SubscriptionService } from './subscription.service'
import { CreateCheckoutDto } from './dto/create-checkout.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

@ApiTags('Subscriptions')
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ── Plans (public) ────────────────────────────────────────────

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'Liste des plans d\'abonnement disponibles' })
  getPlans() {
    return this.subscriptionService.getPlans()
  }

  // ── Authenticated endpoints ───────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Abonnement actuel de l\'utilisateur connecté' })
  getMySubscription(@CurrentUser() user: JwtPayload) {
    return this.subscriptionService.getMySubscription(user.sub)
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Créer une session Stripe Checkout (retourne une URL de redirection)' })
  createCheckoutSession(@CurrentUser() user: JwtPayload, @Body() dto: CreateCheckoutDto) {
    return this.subscriptionService.createCheckoutSession(user.sub, user.email, dto)
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Créer une session Stripe Customer Portal (gestion de l\'abonnement)' })
  createPortalSession(@CurrentUser() user: JwtPayload) {
    return this.subscriptionService.createPortalSession(user.sub)
  }

  // ── Webhook (public, raw body) ────────────────────────────────

  @Post('webhook')
  @Public()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Stripe — ne pas appeler manuellement' })
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.subscriptionService.handleWebhook(req.rawBody!, signature)
  }
}
