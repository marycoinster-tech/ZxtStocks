import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { MINING_PLANS } from '@/constants/plans';
import { formatCurrency, generateReferralCode } from '@/lib/utils';
import { storage } from '@/lib/storage';
import { toast } from 'sonner';
import { MiningSession, Transaction, User } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  PAYSTACK_PUBLIC_KEY,
  validatePaystackKey,
  generatePaymentReference,
  convertToKobo,
  PaystackResponse,
  isPaymentSuccessful,
  initializePaystackPayment,
} from '@/lib/paystack';

async function callEdgeFunction(action: string, payload?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('paystack-transfer', {
    body: { action, ...payload },
  });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try { msg = await error.context?.text() || msg; } catch { /* ignore */ }
    }
    console.error('Edge function error:', msg);
    // Non-fatal — don't block the user from accessing dashboard
  }
  return data;
}

export default function PlansPage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(MINING_PLANS[0].id);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const currentPlan = MINING_PLANS.find((p) => p.id === selectedPlan) || MINING_PLANS[0];
  const hasValidKey = PAYSTACK_PUBLIC_KEY && PAYSTACK_PUBLIC_KEY !== '';

  const handlePaymentSuccess = async (response: PaystackResponse) => {
    console.log('Payment successful:', response);

    if (!isPaymentSuccessful(response)) {
      setIsProcessing(false);
      toast.error('Payment verification failed. Please contact support.');
      return;
    }

    // Determine user id — prefer authenticated user, fall back to localStorage
    const userId = authUser?.id;
    const userEmail = authUser?.email || email;

    // Create / update localStorage user & session (for dashboard progress display)
    const localUser: User = {
      id: userId || Date.now().toString(),
      email: userEmail,
      fullName: authUser?.fullName || fullName,
      referralCode: authUser?.referralCode || generateReferralCode(),
      createdAt: new Date().toISOString(),
    };
    storage.setUser(localUser);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + currentPlan.duration);

    const session: MiningSession = {
      id: Date.now().toString(),
      userId: localUser.id,
      planId: currentPlan.id,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      hashRate: currentPlan.hashRate,
      totalMined: 0,
      status: 'active',
      earnedToday: 0,
    };
    storage.setMiningSession(session);

    const transaction: Transaction = {
      id: Date.now().toString(),
      userId: localUser.id,
      type: 'payment',
      amount: currentPlan.price,
      currency: 'NGN',
      status: 'completed',
      description: `Payment for ${currentPlan.name}`,
      createdAt: new Date().toISOString(),
      reference: response.reference || response.trxref,
    };
    storage.addTransaction(transaction);

    // Sync to Supabase if user is authenticated
    if (userId) {
      console.log('Syncing plan activation to Supabase for user:', userId);

      // 1. Activate plan + credit referral bonus
      await callEdgeFunction('activate_plan', {
        user_id: userId,
        plan_id: currentPlan.id,
        plan_name: currentPlan.name,
        referred_email: userEmail,
      });

      // 2. Insert payment transaction record into DB
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'payment',
          amount: currentPlan.price,
          currency: 'NGN',
          status: 'completed',
          description: `Payment for ${currentPlan.name}`,
          reference: response.reference || response.trxref || null,
          plan_id: currentPlan.id,
          plan_name: currentPlan.name,
        });

      if (txError) {
        console.error('Failed to save payment transaction:', txError);
      } else {
        console.log('Payment transaction saved to DB');
      }
    }

    setIsProcessing(false);
    toast.success('Payment successful! Your mining has started.');
    navigate('/dashboard');
  };

  const handlePaymentClose = () => {
    setIsProcessing(false);
    toast.info('Payment cancelled');
  };

  const handlePayNow = () => {
    if (!email || !fullName) {
      toast.error('Please fill in all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!validatePaystackKey()) {
      return;
    }

    setIsProcessing(true);

    initializePaystackPayment({
      email,
      amount: convertToKobo(currentPlan.price),
      publicKey: PAYSTACK_PUBLIC_KEY,
      reference: generatePaymentReference(),
      metadata: {
        fullName,
        planId: currentPlan.id,
        planName: currentPlan.name,
      },
      onSuccess: handlePaymentSuccess,
      onClose: handlePaymentClose,
    });
  };

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Choose Your Mining Plan</h1>
            <p className="text-muted-foreground text-lg">
              Select a plan and start earning daily returns from crypto mining
            </p>
          </div>

          {!hasValidKey && (
            <Alert variant="destructive" className="mb-8">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Paystack not configured:</strong> Please add your Paystack public key to the .env file.
                <a
                  href="https://dashboard.paystack.com/#/settings/developer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 ml-2 underline"
                >
                  Get your API key
                  <ExternalLink className="w-3 h-3" />
                </a>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Plans */}
            <div className="lg:col-span-2 space-y-6">
              {MINING_PLANS.map((plan) => (
                <Card
                  key={plan.id}
                  className={`cursor-pointer transition-all ${
                    selectedPlan === plan.id
                      ? 'border-primary shadow-lg shadow-primary/20'
                      : 'border-muted/50 hover:border-muted'
                  }`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-2xl">{plan.name}</CardTitle>
                        <CardDescription>30 Days Mining · {plan.monthlyTasks} Tasks/Month</CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-primary">
                          {formatCurrency(plan.price)}
                        </div>
                        {plan.popular && (
                          <Badge className="mt-2">Most Popular</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <div className="text-sm text-muted-foreground">Daily Return</div>
                        <div className="text-xl font-bold text-primary">
                          {formatCurrency(plan.dailyReturn)}
                        </div>
                      </div>
                      <div className="p-3 bg-secondary/10 rounded-lg">
                        <div className="text-sm text-muted-foreground">Total Return</div>
                        <div className="text-xl font-bold text-secondary">
                          {formatCurrency(plan.totalReturn)}
                        </div>
                      </div>
                    </div>
                    <ul className="grid grid-cols-2 gap-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Checkout */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Complete Your Purchase</CardTitle>
                  <CardDescription>Enter your details to proceed</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="border-t border-border pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Selected Plan</span>
                      <span className="font-medium">{currentPlan.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">30 Days</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Monthly Tasks</span>
                      <span className="font-medium">{currentPlan.monthlyTasks} tasks</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Daily Return</span>
                      <span className="font-medium text-primary">
                        {formatCurrency(currentPlan.dailyReturn)}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrency(currentPlan.price)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handlePayNow}
                    disabled={!hasValidKey || isProcessing}
                  >
                    {isProcessing ? 'Processing...' : 'Pay with Paystack'}
                  </Button>
                  
                  {!hasValidKey && (
                    <p className="text-xs text-muted-foreground text-center">
                      Payment disabled: Configure Paystack API key
                    </p>
                  )}
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
