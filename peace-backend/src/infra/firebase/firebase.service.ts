import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth, UserRecord } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App | null = null;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.config.get<string>('firebase.projectId');
    const clientEmail = this.config.get<string>('firebase.clientEmail');
    const privateKey = this.config.get<string>('firebase.privateKey');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase Admin not configured — auth verification disabled until credentials are set.');
      return;
    }

    this.app = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    this.enabled = true;
    this.logger.log('Firebase Admin initialised');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return getAuth(this.app ?? undefined).verifyIdToken(idToken);
  }

  private get auth() {
    return getAuth(this.app ?? undefined);
  }

  async createUser(email: string, password: string, displayName?: string): Promise<UserRecord> {
    return this.auth.createUser({ email, password, displayName });
  }

  async setRoleClaims(uid: string, claims: { role: string; storeId?: string | null }): Promise<void> {
    await this.auth.setCustomUserClaims(uid, claims);
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    try {
      return await this.auth.getUserByEmail(email);
    } catch {
      return null;
    }
  }

  async setDisabled(uid: string, disabled: boolean): Promise<void> {
    await this.auth.updateUser(uid, { disabled });
  }
}
