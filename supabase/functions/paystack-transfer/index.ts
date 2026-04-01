import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

async function paystackRequest(method: string, path: string, body?: Record<string, unknown>) {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    console.error('Paystack API error:', data);
    throw new Error(data.message || 'Paystack API request failed');
  }

  return data.data;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action } = body;

    console.log('paystack-transfer called with action:', action);

    // ── List Banks ───────────────────────────────────────────────────────────
    if (action === 'list_banks') {
      const banks = await paystackRequest('GET', '/bank?country=nigeria&perPage=100');
      return new Response(
        JSON.stringify({ banks }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Verify Account ───────────────────────────────────────────────────────
    if (action === 'verify_account') {
      const { account_number, bank_code } = body;

      if (!account_number || !bank_code) {
        return new Response(
          JSON.stringify({ error: 'account_number and bank_code are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await paystackRequest(
        'GET',
        `/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`
      );

      return new Response(
        JSON.stringify({ account_name: result.account_name, account_number: result.account_number }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Withdraw ─────────────────────────────────────────────────────────────
    if (action === 'withdraw') {
      const { amount, bank_code, bank_name, account_number, account_name, user_id, user_email } = body;

      // Validate inputs
      if (!amount || !bank_code || !account_number || !account_name || !user_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required withdrawal fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (parseFloat(amount) < 5000) {
        return new Response(
          JSON.stringify({ error: 'Minimum withdrawal amount is ₦5,000' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check available balance
      const { data: balanceData, error: balanceError } = await supabaseAdmin
        .from('mining_balances')
        .select('available_balance, total_withdrawn, total_earned')
        .eq('user_id', user_id)
        .maybeSingle();

      const availableBalance = balanceData?.available_balance ?? 0;

      if (parseFloat(amount) > availableBalance) {
        return new Response(
          JSON.stringify({ error: `Insufficient balance. Available: ₦${availableBalance.toLocaleString()}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step 1: Create transfer recipient on Paystack
      console.log('Creating Paystack transfer recipient...');
      const recipient = await paystackRequest('POST', '/transferrecipient', {
        type: 'nuban',
        name: account_name,
        account_number,
        bank_code,
        currency: 'NGN',
        metadata: { user_id, user_email },
      });

      console.log('Recipient created:', recipient.recipient_code);

      // Step 2: Initiate transfer
      const amountInKobo = Math.round(parseFloat(amount) * 100);
      const reference = `ZXT-${user_id.slice(0, 8)}-${Date.now()}`;

      console.log('Initiating Paystack transfer...');
      const transfer = await paystackRequest('POST', '/transfer', {
        source: 'balance',
        amount: amountInKobo,
        recipient: recipient.recipient_code,
        reason: `Zxt Stocks withdrawal for ${user_email}`,
        reference,
      });

      console.log('Transfer initiated:', transfer.transfer_code, 'status:', transfer.status);

      // Step 3: Save withdrawal record to DB
      const { error: insertError } = await supabaseAdmin
        .from('withdrawals')
        .insert({
          user_id,
          amount: parseFloat(amount),
          bank_code,
          bank_name,
          account_number,
          account_name,
          recipient_code: recipient.recipient_code,
          transfer_code: transfer.transfer_code,
          status: transfer.status === 'success' ? 'success' : 'processing',
        });

      if (insertError) {
        console.error('DB insert error:', insertError);
        throw new Error('Failed to record withdrawal: ' + insertError.message);
      }

      // Step 4: Deduct from user balance
      const newBalance = availableBalance - parseFloat(amount);
      const newTotalWithdrawn = (balanceData?.total_withdrawn ?? 0) + parseFloat(amount);

      if (balanceData) {
        await supabaseAdmin
          .from('mining_balances')
          .update({
            available_balance: newBalance,
            total_withdrawn: newTotalWithdrawn,
          })
          .eq('user_id', user_id);
      }

      return new Response(
        JSON.stringify({
          message: 'Withdrawal initiated successfully',
          transfer_code: transfer.transfer_code,
          status: transfer.status,
          reference,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unknown action
    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Edge function error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
