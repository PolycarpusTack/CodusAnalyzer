import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

interface Credentials {
  password: string;
  token: string;
}

export class SecretStore {
  private client: SecretManagerServiceClient;
  private password: string | null = null;

  constructor() {
    this.client = new SecretManagerServiceClient();
  }

  async loadCredentials(secretName: string): Promise<Credentials> {
    const [version] = await this.client.accessSecretVersion({
      name: secretName,
    });

    const payload = version.payload?.data?.toString();
    if (!payload) {
      throw new Error("Empty secret payload");
    }

    const credentials: Credentials = JSON.parse(payload);
    this.password = credentials.password;
    return credentials;
  }

  getPassword(): string {
    if (!this.password) throw new Error("Credentials not loaded");
    return this.password;
  }
}
