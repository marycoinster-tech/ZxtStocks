import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Referral bonus amounts per plan
const REFERRAL_BONUSES: Record<string, number> = {
  starter: 500,
  professional: 1500,
  elite: 3000,
  enterprise: 5000,
};

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

    // ── Credit Referral Bonus ────────────────────────────────────────────────
    // Called after a successful payment to credit the referrer
    if (action === 'credit_referral') {
      const { referred_user_id, referred_email, plan_id, plan_name } = body;

      if (!referred_user_id || !plan_id) {
        return new Response(
          JSON.stringify({ error: 'referred_user_id and plan_id are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the referred user's profile to find their referred_by code
      const { data: referredProfile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('referred_by, email')
        .eq('id', referred_user_id)
        .maybeSingle();

      if (profileError || !referredProfile?.referred_by) {
        console.log('No referral code found for user:', referred_user_id);
        return new Response(
          JSON.stringify({ message: 'No referral to credit' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find the referrer by their referral_code
      const { data: referrerProfile, error: referrerError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email')
        .eq('referral_code', referredProfile.referred_by)
        .maybeSingle();

      if (referrerError || !referrerProfile) {
        console.log('Referrer not found for code:', referredProfile.referred_by);
        return new Response(
          JSON.stringify({ message: 'Referrer not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const bonusAmount = REFERRAL_BONUSES[plan_id] ?? 500;
      const referrerId = referrerProfile.id;

      console.log(`Crediting ₦${bonusAmount} referral bonus to user ${referrerId}`);

      // Check if referral bonus already credited for this pair + plan
      const { data: existingBonus } = await supabaseAdmin
        .from('referral_bonuses')
        .select('id')
        .eq('referrer_id', referrerId)
        .eq('referred_user_id', referred_user_id)
        .eq('plan_id', plan_id)
        .maybeSingle();

      if (existingBonus) {
        return new Response(
          JSON.stringify({ message: 'Referral bonus already credited' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert referral bonus record
      const { error: bonusInsertError } = await supabaseAdmin
        .from('referral_bonuses')
        .insert({
          referrer_id: referrerId,
          referred_user_id,
          referred_email,
          plan_id,
          plan_name,
          bonus_amount: bonusAmount,
          status: 'active',
        });

      if (bonusInsertError) {
        console.error('Failed to insert referral bonus:', bonusInsertError);
        throw new Error('Failed to record referral bonus');
      }

      // Upsert referrer's mining balance — add bonus to available_balance & total_earned
      const { data: existingBalance } = await supabaseAdmin
        .from('mining_balances')
        .select('available_balance, total_earned, total_withdrawn')
        .eq('user_id', referrerId)
        .maybeSingle();

      if (existingBalance) {
        await supabaseAdmin
          .from('mining_balances')
          .update({
            available_balance: existingBalance.available_balance + bonusAmount,
            total_earned: existingBalance.total_earned + bonusAmount,
          })
          .eq('user_id', referrerId);
      } else {
        await supabaseAdmin
          .from('mining_balances')
          .insert({
            user_id: referrerId,
            available_balance: bonusAmount,
            total_earned: bonusAmount,
            total_withdrawn: 0,
          });
      }

      console.log(`Referral bonus of ₦${bonusAmount} credited to ${referrerProfile.email}`);

      return new Response(
        JSON.stringify({ message: 'Referral bonus credited', bonus_amount: bonusAmount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Complete Task ─────────────────────────────────────────────────────────
    if (action === 'complete_task') {
      const { user_id, task_key, task_title, task_description, bonus_amount } = body;

      if (!user_id || !task_key) {
        return new Response(
          JSON.stringify({ error: 'user_id and task_key are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if task already completed
      const { data: existing } = await supabaseAdmin
        .from('user_tasks')
        .select('id')
        .eq('user_id', user_id)
        .eq('task_key', task_key)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: 'Task already completed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Record task completion
      const { error: taskError } = await supabaseAdmin
        .from('user_tasks')
        .insert({
          user_id,
          task_key,
          task_title,
          task_description,
          bonus_amount: bonus_amount ?? 0,
        });

      if (taskError) {
        console.error('Task insert error:', taskError);
        throw new Error('Failed to record task completion');
      }

      // Credit bonus to user's mining balance
      if (bonus_amount && bonus_amount > 0) {
        const { data: existingBalance } = await supabaseAdmin
          .from('mining_balances')
          .select('available_balance, total_earned, total_withdrawn')
          .eq('user_id', user_id)
          .maybeSingle();

        if (existingBalance) {
          await supabaseAdmin
            .from('mining_balances')
            .update({
              available_balance: existingBalance.available_balance + bonus_amount,
              total_earned: existingBalance.total_earned + bonus_amount,
            })
            .eq('user_id', user_id);
        } else {
          await supabaseAdmin
            .from('mining_balances')
            .insert({
              user_id,
              available_balance: bonus_amount,
              total_earned: bonus_amount,
              total_withdrawn: 0,
            });
        }
      }

      return new Response(
        JSON.stringify({ message: 'Task completed successfully', bonus_credited: bonus_amount }),
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
      const { data: balanceData } = await supabaseAdmin
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
