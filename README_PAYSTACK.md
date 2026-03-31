# Paystack Integration Guide

This application uses Paystack for payment processing. Follow these steps to set up and configure Paystack.

## 1. Get Your Paystack API Keys

1. Sign up for a Paystack account at [https://dashboard.paystack.com/signup](https://dashboard.paystack.com/signup)
2. Login to your dashboard at [https://dashboard.paystack.com](https://dashboard.paystack.com)
3. Navigate to **Settings** → **API Keys & Webhooks**
4. Copy your **Public Key** (starts with `pk_test_` for test mode or `pk_live_` for live mode)

## 2. Configure Environment Variables

1. Create a `.env` file in the root directory of your project
2. Add your Paystack public key:

```env
VITE_PAYSTACK_PUBLIC_KEY=pk_test_your_actual_key_here
```

**Important Notes:**
- ✅ Use **test keys** (`pk_test_...`) during development
- ✅ Use **live keys** (`pk_live_...`) only in production
- ❌ **Never** use secret keys on the client side
- ❌ **Never** commit your `.env` file to version control

## 3. Test the Integration

### Test Cards for Development

Use these test cards in test mode:

**Successful Transaction:**
```
Card Number: 4084 0840 8408 4081
CVV: 408
Expiry: Any future date
PIN: 0000
OTP: 123456
```

**Declined Transaction:**
```
Card Number: 5060 6666 6666 6666
CVV: 123
Expiry: Any future date
```

## 4. Payment Flow

1. **User fills form** → Full name, email, phone (optional)
2. **Click "Continue to Payment"** → Validates form and Paystack key
3. **Click "Pay with Paystack"** → Opens Paystack payment modal
4. **Complete payment** → Enter card details
5. **Payment success** → User account created, mining session started
6. **Redirect to dashboard** → View mining progress

## 5. How It Works

### Client-Side (Current Implementation)
```typescript
import { PaystackButton } from 'react-paystack';

const config = {
  email: user.email,
  amount: price * 100, // Convert to kobo
  publicKey: PAYSTACK_PUBLIC_KEY,
  metadata: { fullName, planId, planName },
  reference: 'ZXT-timestamp-random',
  onSuccess: (response) => { /* Handle success */ },
  onClose: () => { /* Handle cancellation */ },
};
```

### Amount Conversion
- Paystack expects amounts in **kobo** (smallest currency unit)
- ₦3,500 = 350,000 kobo
- Always multiply Naira by 100: `amount * 100`

### Payment References
- Format: `ZXT-{timestamp}-{random}`
- Example: `ZXT-1234567890-ABC123`
- Must be unique for each transaction

## 6. Production Recommendations

### Payment Verification (Server-Side)
For production, implement server-side verification:

```typescript
// Backend endpoint
app.post('/api/verify-payment', async (req, res) => {
  const { reference } = req.body;
  
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    }
  );
  
  const data = await response.json();
  
  if (data.status && data.data.status === 'success') {
    // Create user account
    // Start mining session
    // Send confirmation email
    res.json({ verified: true });
  } else {
    res.json({ verified: false });
  }
});
```

### Webhook Integration
Set up webhooks to receive real-time payment notifications:

1. Go to **Settings** → **API Keys & Webhooks** → **Webhooks**
2. Add your webhook URL: `https://yourdomain.com/api/webhooks/paystack`
3. Select events to monitor: `charge.success`, `transfer.success`
4. Implement webhook handler:

```typescript
app.post('/api/webhooks/paystack', (req, res) => {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');
    
  if (hash === req.headers['x-paystack-signature']) {
    const event = req.body;
    
    switch(event.event) {
      case 'charge.success':
        // Handle successful payment
        break;
      case 'transfer.success':
        // Handle successful withdrawal
        break;
    }
    
    res.sendStatus(200);
  } else {
    res.sendStatus(400);
  }
});
```

## 7. Security Best Practices

- ✅ Always use HTTPS in production
- ✅ Verify payments on the server, never trust client-side responses alone
- ✅ Store secret keys in environment variables, never in code
- ✅ Implement webhook signature verification
- ✅ Log all transactions for audit purposes
- ✅ Set up fraud detection rules in Paystack dashboard

## 8. Testing Checklist

- [ ] Test successful payment flow
- [ ] Test payment cancellation
- [ ] Test with declined cards
- [ ] Verify transaction appears in Paystack dashboard
- [ ] Confirm user account is created
- [ ] Confirm mining session starts
- [ ] Test with different email addresses
- [ ] Test with international cards (if applicable)

## 9. Going Live

Before switching to live mode:

1. Complete Paystack business verification
2. Replace `VITE_PAYSTACK_PUBLIC_KEY` with your live public key
3. Implement server-side payment verification
4. Set up webhooks for production URL
5. Test thoroughly with real cards (small amounts)
6. Monitor transactions in dashboard

## 10. Support

- Paystack Documentation: [https://paystack.com/docs](https://paystack.com/docs)
- Support Email: support@paystack.com
- Developer Community: [https://paystack.com/community](https://paystack.com/community)

## Common Issues

**"Paystack public key not configured"**
- Solution: Add `VITE_PAYSTACK_PUBLIC_KEY` to your `.env` file

**"Invalid public key format"**
- Solution: Ensure your key starts with `pk_test_` or `pk_live_`

**Payment modal doesn't open**
- Solution: Check browser console for errors, ensure react-paystack is installed

**Amount showing incorrectly**
- Solution: Remember to multiply by 100 to convert to kobo
