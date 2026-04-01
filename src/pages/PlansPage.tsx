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
import {
  PAYSTACK_PUBLIC_KEY,
  validatePaystackKey,
  generatePaymentReference,
  convertToKobo,
  PaystackResponse,
  isPaymentSuccessful,
  initializePaystackPayment,
} from '@/lib/paystack';

export default function PlansPage() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState(MINING_PLANS[0].id);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const currentPlan = MINING_PLANS.find((p) => p.id === selectedPlan) || MINING_PLANS[0];
  const hasValidKey = PAYSTACK_PUBLIC_KEY && PAYSTACK_PUBLIC_KEY !== '';

  const handlePaymentSuccess = (response: PaystackResponse) => {
    console.log('Payment successful:', response);
    setIsProcessing(false);

    if (!isPaymentSuccessful(response)) {
      toast.error('Payment verification failed. Please contact support.');
      return;
    }

    // Create user
    const user: User = {
      id: Date.now().toString(),
      email,
      fullName,
      referralCode: generateReferralCode(),
      createdAt: new Date().toISOString(),
    };
    storage.setUser(user);

    // Create mining session
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + currentPlan.duration);

    const session: MiningSession = {
      id: Date.now().toString(),
      userId: user.id,
      planId: currentPlan.id,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      hashRate: currentPlan.hashRate,
      totalMined: 0,
      status: 'active',
      earnedToday: 0,
    };
    storage.setMiningSession(session);

    // Add payment transaction
    const transaction: Transaction = {
      id: Date.now().toString(),
      userId: user.id,
      type: 'payment',
      amount: currentPlan.price,
      currency: 'NGN',
      status: 'completed',
      description: `Payment for ${currentPlan.name}`,
      createdAt: new Date().toISOString(),
      reference: response.reference || response.trxref,
    };
    storage.addTransaction(transaction);

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
