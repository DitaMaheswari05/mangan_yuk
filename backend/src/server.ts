import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
import { AuthService } from './auth/service';
import { PrismaAuthStore } from './auth/store.prisma';
import { loadConfig } from './config';
import { ConsoleMailer } from './mailer';
import { ReviewService } from './reviews/service';
import { PrismaReviewStore } from './reviews/store.prisma';

const config = loadConfig();
const prisma = new PrismaClient();
const auth = new AuthService({ store: new PrismaAuthStore(prisma), mailer: new ConsoleMailer(), config });
const reviews = new ReviewService({ store: new PrismaReviewStore(prisma) });

createApp({ auth, reviews, trustProxy: config.trustProxy }).listen(config.port, () => {
  console.info(`Mangan Yuk API berjalan di http://localhost:${config.port}/v1`);
});
