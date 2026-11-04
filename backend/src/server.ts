import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
import { AuthService } from './auth/service';
import { PrismaAuthStore } from './auth/store.prisma';
import { loadConfig } from './config';
import { ConsoleMailer } from './mailer';

const config = loadConfig();
const auth = new AuthService({ store: new PrismaAuthStore(new PrismaClient()), mailer: new ConsoleMailer(), config });

createApp({ auth, trustProxy: config.trustProxy }).listen(config.port, () => {
  console.info(`Mangan Yuk API berjalan di http://localhost:${config.port}/v1`);
});
