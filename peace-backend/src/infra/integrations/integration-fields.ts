// Every key the admin Integrations page can set. `secret` fields are encrypted,
// masked on read and kept when left blank on save.
export const INTEGRATION_FIELDS = {
  razorpay: { keyId: false, keySecret: true, webhookSecret: true },
  bharatship: {
    email: false,
    password: true,
    pickupAddressId: false,
    courierCode: false,
    defaultWeightGrams: false,
    apiBase: false,
  },
  email: {
    fromAddress: false,
    smtpHost: false,
    smtpPort: false,
    smtpUser: false,
    smtpPass: true,
  },
  sms: { senderId: false, apiKey: true },
  whatsapp: { phoneNumberId: false, accessToken: true },
} as const;

type Fields = typeof INTEGRATION_FIELDS;
export type IntegrationGroup = keyof Fields;
export type IntegrationSettings = {
  [G in IntegrationGroup]: Partial<Record<keyof Fields[G], string>>;
};

export const MASK = '••••••••';
