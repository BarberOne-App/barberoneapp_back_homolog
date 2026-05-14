// src/config/efiClient.ts

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const EfiPay = require('sdk-node-apis-efi');

const certificate =
  process.env.EFI_CERTIFICATE_BASE64 || process.env.EFI_CERTIFICATE_PATH;

if (!process.env.EFI_CLIENT_ID) {
  throw new Error('EFI_CLIENT_ID não configurado.');
}

if (!process.env.EFI_CLIENT_SECRET) {
  throw new Error('EFI_CLIENT_SECRET não configurado.');
}

if (!certificate) {
  throw new Error('Certificado Efí não configurado.');
}

const efiClient = new EfiPay({
  sandbox: String(process.env.EFI_SANDBOX).toLowerCase() === 'true',
  client_id: process.env.EFI_CLIENT_ID,
  client_secret: process.env.EFI_CLIENT_SECRET,
  certificate,
  cert_base64: Boolean(process.env.EFI_CERTIFICATE_BASE64),
});

export default efiClient;