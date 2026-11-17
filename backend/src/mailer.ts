export interface Mailer {
  sendPasswordReset(to: string, link: string): Promise<void>;
}

// OWASP M9: Cegah kebocoran token reset password di server logs.
export class ConsoleMailer implements Mailer {
  async sendPasswordReset(to: string, link: string) {
    if (process.env.NODE_ENV === 'production') {
      console.info(`[mail] Instruksi reset password telah dikirim ke ${to}`);
    } else {
      // Sensor token di log development untuk keamanan
      const masked = link.replace(/token=([^&]{6})[^&]+/, 'token=$1...');
      console.info(`[mail:dev] reset password untuk ${to}: ${masked}`);
    }
  }
}
