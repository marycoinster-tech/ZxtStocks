import { usePaystackPayment as usePaystackHook } from 'react-paystack';
import { PaystackConfig } from '@/lib/paystack';

/**
 * Custom hook for Paystack payment using React Hooks pattern
 * Alternative to PaystackButton component
 */
export function usePaystackPayment(config: PaystackConfig) {
  const initializePayment = usePaystackHook(config);
  
  return {
    initializePayment,
  };
}
