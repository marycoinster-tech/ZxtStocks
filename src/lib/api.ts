/**
 * API client for server-side operations
 * Note: Payment verification should be done server-side for security
 */

const PAYSTACK_SECRET_KEY = import.meta.env.VITE_PAYSTACK_SECRET_KEY;

export interface VerifyPaymentResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    customer: {
      id: number;
      email: string;
      customer_code: string;
    };
    metadata: any;
  };
}

/**
 * Verify payment on the server side
 * WARNING: This is a client-side implementation for demo purposes
 * In production, payment verification MUST be done on the server
 */
export async function verifyPaystackPayment(reference: string): Promise<VerifyPaymentResponse> {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack secret key not configured');
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Payment verification failed');
  }

  return response.json();
}

/**
 * For production: Create a backend endpoint that verifies payments
 * Example implementation:
 */
export async function verifyPaymentOnBackend(reference: string): Promise<boolean> {
  try {
    // Replace with your actual backend endpoint
    const response = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reference }),
    });

    const data = await response.json();
    return data.verified === true;
  } catch (error) {
    console.error('Payment verification error:', error);
    return false;
  }
}
