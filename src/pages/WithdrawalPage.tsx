import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  Wallet,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  ArrowDownToLine,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { formatCurrency } from '@/lib/utils';

interface Bank {
  id: number;
  name: string;
  code: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'reversed';
  failure_reason: string | null;
  created_at: string;
}

interface MiningBalance {
  available_balance: number;
  total_earned: number;
  total_withdrawn: number;
}

const MIN_WITHDRAWAL = 5000;

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  processing: { label: 'Processing', icon: RefreshCw, className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  success: { label: 'Completed', icon: CheckCircle2, className: 'bg-green-500/10 text-green-500 border-green-500/20' },
  failed: { label: 'Failed', icon: XCircle, className: 'bg-red-500/10 text-red-500 border-red-500/20' },
  reversed: { label: 'Reversed', icon: AlertCircle, className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
};

async function callEdgeFunction(action: string, payload?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('paystack-transfer', {
    body: { action, ...payload },
  });

  if (error) {
    let errorMessage = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const statusCode = error.context?.status ?? 500;
        const textContent = await error.context?.text();
        errorMessage = `[Code: ${statusCode}] ${textContent || error.message || 'Unknown error'}`;
      } catch {
        errorMessage = error.message || 'Failed to read response';
      }
    }
    throw new Error(errorMessage);
  }

  return data;
}

export default function WithdrawalPage() {
  const { user } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [balance, setBalance] = useState<MiningBalance>({ available_balance: 0, total_earned: 0, total_withdrawn: 0 });
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedBank, setSelectedBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');

  useEffect(() => {
    fetchBanks();
    fetchBalance();
    fetchWithdrawals();
  }, [user]);

  // Auto-verify account when bank + 10-digit number are provided
  useEffect(() => {
    if (selectedBank && accountNumber.length === 10) {
      verifyAccount();
    } else {
      setAccountName('');
    }
  }, [selectedBank, accountNumber]);

  const fetchBanks = async () => {
    setLoadingBanks(true);
    try {
      const data = await callEdgeFunction('list_banks');
      setBanks(data.banks || []);
    } catch (error: any) {
      toast.error('Failed to load banks: ' + error.message);
    } finally {
      setLoadingBanks(false);
    }
  };

  const fetchBalance = async () => {
    if (!user) return;
    setLoadingBalance(true);
    const { data, error } = await supabase
      .from('mining_balances')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setBalance(data);
    }
    setLoadingBalance(false);
  };

  const fetchWithdrawals = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setWithdrawals(data as Withdrawal[]);
    }
  };

  const verifyAccount = async () => {
    if (!selectedBank || accountNumber.length !== 10) return;
    setVerifying(true);
    setAccountName('');
    try {
      const data = await callEdgeFunction('verify_account', {
        account_number: accountNumber,
        bank_code: selectedBank,
      });
      setAccountName(data.account_name);
      toast.success('Account verified: ' + data.account_name);
    } catch (error: any) {
      toast.error('Account verification failed. Check details and try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();

    const withdrawAmount = parseFloat(amount);

    if (!selectedBank || !accountNumber || !accountName) {
      toast.error('Please complete bank account details');
      return;
    }

    if (!withdrawAmount || withdrawAmount < MIN_WITHDRAWAL) {
      toast.error(`Minimum withdrawal is ${formatCurrency(MIN_WITHDRAWAL)}`);
      return;
    }

    if (withdrawAmount > balance.available_balance) {
      toast.error('Insufficient balance');
      return;
    }

    setSubmitting(true);
    try {
      const data = await callEdgeFunction('withdraw', {
        amount: withdrawAmount,
        bank_code: selectedBank,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        user_id: user!.id,
        user_email: user!.email,
      });

      toast.success('Withdrawal request submitted successfully!');
      setAmount('');
      setSelectedBank('');
      setAccountNumber('');
      setAccountName('');
      setBankName('');
      fetchBalance();
      fetchWithdrawals();
    } catch (error: any) {
      toast.error('Withdrawal failed: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBankChange = (code: string) => {
    setSelectedBank(code);
    const bank = banks.find((b) => b.code === code);
    setBankName(bank?.name || '');
    setAccountName('');
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Withdraw Earnings</h1>
        <p className="text-muted-foreground mt-1">Transfer your mining profits directly to your Nigerian bank account</p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Available Balance</span>
            </div>
            {loadingBalance ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <div className="text-2xl font-bold text-primary">{formatCurrency(balance.available_balance)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <span className="text-sm text-muted-foreground">Total Earned</span>
            </div>
            {loadingBalance ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(balance.total_earned)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <ArrowDownToLine className="w-5 h-5 text-orange-500" />
              </div>
              <span className="text-sm text-muted-foreground">Total Withdrawn</span>
            </div>
            {loadingBalance ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(balance.total_withdrawn)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Withdrawal Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Request Withdrawal
            </CardTitle>
            <CardDescription>Minimum withdrawal: {formatCurrency(MIN_WITHDRAWAL)}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleWithdraw} className="space-y-5">
              {/* Bank Selection */}
              <div className="space-y-2">
                <Label>Bank</Label>
                {loadingBanks ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading banks...
                  </div>
                ) : (
                  <Select value={selectedBank} onValueChange={handleBankChange} disabled={submitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank) => (
                        <SelectItem key={bank.code} value={bank.code}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Account Number */}
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  placeholder="10-digit account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  disabled={submitting}
                  maxLength={10}
                />
              </div>

              {/* Account Name (auto-filled) */}
              <div className="space-y-2">
                <Label>Account Name</Label>
                {verifying ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying account...
                  </div>
                ) : accountName ? (
                  <Alert className="border-green-500/30 bg-green-500/5">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-600 font-medium">{accountName}</AlertDescription>
                  </Alert>
                ) : (
                  <p className="text-sm text-muted-foreground py-1">
                    Select a bank and enter your 10-digit account number to auto-verify
                  </p>
                )}
              </div>

              <Separator />

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Withdrawal Amount (NGN)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder={`Minimum ${formatCurrency(MIN_WITHDRAWAL)}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={MIN_WITHDRAWAL}
                  max={balance.available_balance}
                  disabled={submitting}
                />
                {balance.available_balance > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setAmount(balance.available_balance.toString())}
                  >
                    Use max: {formatCurrency(balance.available_balance)}
                  </button>
                )}
              </div>

              {balance.available_balance < MIN_WITHDRAWAL && !loadingBalance && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your balance ({formatCurrency(balance.available_balance)}) is below the minimum withdrawal of{' '}
                    {formatCurrency(MIN_WITHDRAWAL)}. Keep mining to earn more!
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={
                  submitting ||
                  !accountName ||
                  !amount ||
                  parseFloat(amount) < MIN_WITHDRAWAL ||
                  parseFloat(amount) > balance.available_balance
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Withdraw {amount ? formatCurrency(parseFloat(amount)) : ''}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <div className="space-y-6">
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader>
              <CardTitle className="text-base">How Withdrawals Work</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>Enter your Nigerian bank account details for instant verification</span>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>Minimum withdrawal amount is {formatCurrency(MIN_WITHDRAWAL)}</span>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>Transfers are processed instantly via Paystack to your bank</span>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>All major Nigerian banks are supported</span>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>Track all withdrawal history and status below</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                Important Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Ensure your account number and bank are correct before submitting</p>
              <p>• Withdrawals are final and cannot be reversed once processed</p>
              <p>• Contact support if a transfer fails or is delayed</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Withdrawal History */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Withdrawal History</h2>
        <Card>
          <CardContent className="p-0">
            {withdrawals.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <ArrowDownToLine className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No withdrawals yet. Your approved payouts will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((w) => {
                      const cfg = statusConfig[w.status];
                      const Icon = cfg.icon;
                      return (
                        <TableRow key={w.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(w.created_at).toLocaleDateString('en-NG', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(w.amount)}</TableCell>
                          <TableCell className="text-sm">{w.bank_name}</TableCell>
                          <TableCell className="text-sm font-mono">{w.account_number}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1 ${cfg.className}`}>
                              <Icon className="w-3 h-3" />
                              {cfg.label}
                            </Badge>
                            {w.failure_reason && (
                              <p className="text-xs text-red-500 mt-1">{w.failure_reason}</p>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
