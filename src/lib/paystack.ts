import { toast } from 'sonner';

export const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';

export interface PaystackConfig {
  email: string;
  amount: number; // Amount in kobo (multiply NGN by 100)
  publicKey: string;
  text?: string;
  metadata?: {
    fullName: string;
    planId: string;
    planName: string;
    [key: string]: any;
  };
  reference?: string;
  onSuccess: (reference: any) => void;
  onClose: () => void;
}

export function generatePaymentReference(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `ZXT-${timestamp}-${random}`;
}

export function convertToKobo(amountInNaira: number): number {
  return Math.round(amountInNaira * 100);
}

export function convertToNaira(amountInKobo: number): number {
  return amountInKobo / 100;
}

export function validatePaystackKey(): boolean {
  if (!PAYSTACK_PUBLIC_KEY) {
    toast.error('Paystack public key not configured. Please add VITE_PAYSTACK_PUBLIC_KEY to your environment variables.');
    return false;
  }
  
  if (!PAYSTACK_PUBLIC_KEY.startsWith('pk_')) {
    toast.error('Invalid Paystack public key format. Key should start with pk_');
    return false;
  }
  
  return true;
}

export interface PaystackResponse {
  reference: string;
  status: string;
  trans: string;
  transaction: string;
  message: string;
  trxref: string;
}

export function isPaymentSuccessful(response: PaystackResponse): boolean {
  return response.status === 'success';
}
