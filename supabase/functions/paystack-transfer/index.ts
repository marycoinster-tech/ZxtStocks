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

    // ── Activate Plan (called after successful Paystack payment) ────────────
    if (action === 'activate_plan') {
      const { user_id, plan_id, plan_name, referred_email } = body;

      if (!user_id || !plan_id) {
        return new Response(
          JSON.stringify({ error: 'user_id and plan_id are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Activating plan ${plan_id} for user ${user_id}`);

      // Upsert mining_balances row — create if first time, leave balance intact if upgrading
      const { data: existingBalance } = await supabaseAdmin
        .from('mining_balances')
        .select('id, available_balance, total_earned, total_withdrawn')
        .eq('user_id', user_id)
        .maybeSingle();

      if (!existingBalance) {
        const { error: insertErr } = await supabaseAdmin
          .from('mining_balances')
          .insert({
            user_id,
            available_balance: 0,
            total_earned: 0,
            total_withdrawn: 0,
          });
        if (insertErr) {
          console.error('Failed to create mining_balances:', insertErr);
          throw new Error('Failed to initialise mining balance');
        }
      }

      // Credit referral bonus for the referrer (inline — same logic as credit_referral)
      const { data: referredProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('referred_by, email')
        .eq('id', user_id)
        .maybeSingle();

      let referralCredited = false;
      if (referredProfile?.referred_by) {
        const { data: referrerProfile } = await supabaseAdmin
          .from('user_profiles')
          .select('id, email')
          .eq('referral_code', referredProfile.referred_by)
          .maybeSingle();

        if (referrerProfile) {
          const bonusAmount = REFERRAL_BONUSES[plan_id] ?? 500;
          const referrerId = referrerProfile.id;

          // Avoid duplicate crediting
          const { data: existingBonus } = await supabaseAdmin
            .from('referral_bonuses')
            .select('id')
            .eq('referrer_id', referrerId)
            .eq('referred_user_id', user_id)
            .eq('plan_id', plan_id)
            .maybeSingle();

          if (!existingBonus) {
            await supabaseAdmin.from('referral_bonuses').insert({
              referrer_id: referrerId,
              referred_user_id: user_id,
              referred_email: referred_email || referredProfile.email || '',
              plan_id,
              plan_name: plan_name || plan_id,
              bonus_amount: bonusAmount,
              status: 'active',
            });

            // Credit referrer's balance
            const { data: refBalance } = await supabaseAdmin
              .from('mining_balances')
              .select('available_balance, total_earned, total_withdrawn')
              .eq('user_id', referrerId)
              .maybeSingle();

            if (refBalance) {
              await supabaseAdmin
                .from('mining_balances')
                .update({
                  available_balance: refBalance.available_balance + bonusAmount,
                  total_earned: refBalance.total_earned + bonusAmount,
                })
                .eq('user_id', referrerId);
            } else {
              await supabaseAdmin.from('mining_balances').insert({
                user_id: referrerId,
                available_balance: bonusAmount,
                total_earned: bonusAmount,
                total_withdrawn: 0,
              });
            }

            referralCredited = true;
            console.log(`Referral bonus ₦${bonusAmount} credited to ${referrerProfile.email}`);

            // Log referral bonus as a transaction for the referrer
            await supabaseAdmin
              .from('transactions')
              .insert({
                user_id: referrerId,
                type: 'referral_bonus',
                amount: bonusAmount,
                currency: 'NGN',
                status: 'completed',
                description: `Referral bonus — ${referredProfile.email || 'a friend'} joined ${plan_name || plan_id}`,
                plan_id,
                plan_name: plan_name || plan_id,
              })
              .then(({ error }) => {
                if (error) console.error('Failed to log referral transaction:', error);
              });
          }
        }
      }

      return new Response(
        JSON.stringify({
          message: 'Plan activated successfully',
          referral_credited: referralCredited,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

      // Log task bonus as a transaction
      if (bonus_amount && bonus_amount > 0) {
        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id,
            type: 'task_bonus',
            amount: bonus_amount,
            currency: 'NGN',
            status: 'completed',
            description: `Task completed: ${task_title}`,
          })
          .then(({ error }) => {
            if (error) console.error('Failed to log task transaction:', error);
          });
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

      // Step 3b: Insert into transactions table for unified history
      await supabaseAdmin
        .from('transactions')
        .insert({
          user_id,
          type: 'withdrawal',
          amount: parseFloat(amount),
          currency: 'NGN',
          status: transfer.status === 'success' ? 'completed' : 'pending',
          description: `Withdrawal to ${bank_name} (${account_number})`,
          reference: reference,
        })
        .then(({ error }) => {
          if (error) console.error('Failed to log withdrawal transaction:', error);
        });

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

    // ── Admin Dashboard Stats ────────────────────────────────────────────────
    if (action === 'admin_stats') {
      // Server-side admin guard — only these emails can call this action
      const ADMIN_EMAILS = ['admin@zxtstocks.com', 'support@zxtstocks.com', 'iandanger121@gmail.com'];

      // Verify caller via JWT
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

      const { data: { user: caller }, error: callerErr } = await supabaseUser.auth.getUser(token);
      if (callerErr || !caller) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!ADMIN_EMAILS.includes(caller.email ?? '')) {
        return new Response(JSON.stringify({ error: 'Forbidden: not an admin' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch all data using service role
      const [profilesRes, balancesRes, withdrawalsRes, transactionsRes] = await Promise.all([
        supabaseAdmin.from('user_profiles').select('id, email, username, referral_code, referred_by'),
        supabaseAdmin.from('mining_balances').select('user_id, available_balance, total_earned, total_withdrawn, updated_at'),
        supabaseAdmin.from('withdrawals').select('id, user_id, amount, bank_name, account_number, account_name, status, created_at, failure_reason').order('created_at', { ascending: false }),
        supabaseAdmin.from('transactions').select('id, user_id, type, amount, status, description, plan_name, created_at').order('created_at', { ascending: false }).limit(200),
      ]);

      // Aggregate stats
      const profiles = profilesRes.data ?? [];
      const balances = balancesRes.data ?? [];
      const withdrawals = withdrawalsRes.data ?? [];
      const transactions = transactionsRes.data ?? [];

      const totalRevenue = transactions
        .filter((t: Record<string, unknown>) => t.type === 'payment' && t.status === 'completed')
        .reduce((s: number, t: Record<string, unknown>) => s + (t.amount as number), 0);

      const pendingWithdrawals = withdrawals.filter((w: Record<string, unknown>) => w.status === 'pending' || w.status === 'processing');
      const pendingWithdrawalTotal = pendingWithdrawals.reduce((s: number, w: Record<string, unknown>) => s + (w.amount as number), 0);

      const totalPaidOut = withdrawals
        .filter((w: Record<string, unknown>) => w.status === 'success')
        .reduce((s: number, w: Record<string, unknown>) => s + (w.amount as number), 0);

      return new Response(
        JSON.stringify({
          stats: {
            total_users: profiles.length,
            total_revenue: totalRevenue,
            total_paid_out: totalPaidOut,
            pending_withdrawals_count: pendingWithdrawals.length,
            pending_withdrawals_total: pendingWithdrawalTotal,
          },
          profiles,
          balances,
          withdrawals,
          transactions,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Update Withdrawal Status (Admin) ───────────────────────────────────
    if (action === 'update_withdrawal_status') {
      const ADMIN_EMAILS = ['admin@zxtstocks.com', 'support@zxtstocks.com', 'iandanger121@gmail.com'];

      // Verify caller via JWT
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

      const { data: { user: caller }, error: callerErr } = await supabaseUser.auth.getUser(token);
      if (callerErr || !caller || !ADMIN_EMAILS.includes(caller.email ?? '')) {
        return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { withdrawal_id, new_status } = body;

      if (!withdrawal_id || !['success', 'failed'].includes(new_status)) {
        return new Response(
          JSON.stringify({ error: 'withdrawal_id and new_status (success|failed) are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch withdrawal to get amount/user_id and current status
      const { data: withdrawal, error: fetchErr } = await supabaseAdmin
        .from('withdrawals')
        .select('id, user_id, amount, status')
        .eq('id', withdrawal_id)
        .maybeSingle();

      if (fetchErr || !withdrawal) {
        return new Response(
          JSON.stringify({ error: 'Withdrawal not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (withdrawal.status === 'success' || withdrawal.status === 'failed') {
        return new Response(
          JSON.stringify({ error: `Withdrawal already marked as ${withdrawal.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update the withdrawal status
      const { error: updateErr } = await supabaseAdmin
        .from('withdrawals')
        .update({ status: new_status, failure_reason: new_status === 'failed' ? 'Marked failed by admin' : null })
        .eq('id', withdrawal_id);

      if (updateErr) {
        console.error('Failed to update withdrawal status:', updateErr);
        throw new Error('Failed to update withdrawal status');
      }

      // If marking as failed, refund the amount back to the user's balance
      if (new_status === 'failed') {
        const { data: balData } = await supabaseAdmin
          .from('mining_balances')
          .select('available_balance, total_withdrawn')
          .eq('user_id', withdrawal.user_id)
          .maybeSingle();

        if (balData) {
          await supabaseAdmin
            .from('mining_balances')
            .update({
              available_balance: balData.available_balance + withdrawal.amount,
              total_withdrawn: Math.max(0, balData.total_withdrawn - withdrawal.amount),
            })
            .eq('user_id', withdrawal.user_id);

          console.log(`Refunded ₦${withdrawal.amount} to user ${withdrawal.user_id} after failed withdrawal`);
        }

        // Update corresponding transaction to failed
        await supabaseAdmin
          .from('transactions')
          .update({ status: 'failed' })
          .eq('user_id', withdrawal.user_id)
          .eq('type', 'withdrawal')
          .eq('amount', withdrawal.amount);
      } else {
        // Mark corresponding transaction as completed
        await supabaseAdmin
          .from('transactions')
          .update({ status: 'completed' })
          .eq('user_id', withdrawal.user_id)
          .eq('type', 'withdrawal')
          .eq('amount', withdrawal.amount)
          .eq('status', 'pending');
      }

      console.log(`Admin ${caller.email} marked withdrawal ${withdrawal_id} as ${new_status}`);

      return new Response(
        JSON.stringify({ message: `Withdrawal marked as ${new_status}`, refunded: new_status === 'failed' }),
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
