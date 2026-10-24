import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AccountService } from "./account/account.service.js";
import { AndroidController } from "./android/android.controller.js";
import { AndroidService } from "./android/android.service.js";
import { AuthGuard } from "./auth/auth.guard.js";
import { AuthService } from "./auth/auth.service.js";
import { BetaCodeController } from "./beta/codes.controller.js";
import { BetaCodeService } from "./beta/codes.js";
import { InviteService } from "./beta/invites.js";
import { BillingController } from "./billing/billing.controller.js";
import { BillingService } from "./billing/billing.service.js";
import { BillingHandlers } from "./billing/handlers.js";
import { InboxService } from "./billing/inbox.service.js";
import { PaddleService } from "./billing/paddle.service.js";
import { WebhooksController } from "./billing/webhooks.controller.js";
import { CreditsService } from "./credits/credits.service.js";
import { LedgerService } from "./credits/ledger.service.js";
import { EventBus } from "./events/event-bus.js";
import { FeedbackController } from "./feedback/feedback.controller.js";
import { FeedbackService } from "./feedback/feedback.service.js";
import { GalleryService } from "./gallery/gallery.service.js";
import { MeController } from "./me.controller.js";
import { PrismaService } from "./prisma.js";
import { ProjectsController } from "./projects/projects.controller.js";
import { ProjectsService } from "./projects/projects.service.js";
import { ProjectViews } from "./projects/views.js";
import { PublicController } from "./public.controller.js";
import { KeyProxy } from "./runs/key-proxy.js";
import { RunRegistry } from "./runs/registry.js";
import { RunsService } from "./runs/runs.service.js";

@Module({
  controllers: [MeController, ProjectsController, PublicController, WebhooksController, BillingController, AndroidController, FeedbackController, BetaCodeController],
  providers: [
    PrismaService,
    LedgerService,
    PaddleService,
    BillingHandlers,
    InboxService,
    BillingService,
    InviteService,
    AuthService,
    BetaCodeService,
    CreditsService,
    EventBus,
    RunRegistry,
    KeyProxy,
    GalleryService,
    ProjectViews,
    RunsService,
    AndroidService,
    ProjectsService,
    AccountService,
    FeedbackService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
