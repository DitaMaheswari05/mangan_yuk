export interface Mailer {
  sendPasswordReset(to: string, link: string): Promise<void>;
}

// Belum ada penyedia email. Selama pengembangan link reset dicetak ke log server;
// ganti dengan implementasi SMTP/Resend sebelum rilis.
export class ConsoleMailer implements Mailer {
  async sendPasswordReset(to: string, link: string) {
    console.info(`[mail] reset password untuk ${to}: ${link}`);
  }
}
