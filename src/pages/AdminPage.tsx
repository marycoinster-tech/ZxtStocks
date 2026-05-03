import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  DollarSign,
  ArrowDownToLine,
  Clock,
  Shield,
  Loader2,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  BarChart3,
  Activity,
  BadgeCheck,
  Ban,
  Megaphone,
  Send,
  X,
  Trash2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';

// ── Hardcoded admin email allowlist ──────────────────────────────────────────
// Add your admin email(s) here. Only these emails can access the admin panel.
const ADMIN_EMAILS = ['admin@zxtstocks.com', 'support@zxtstocks.com', 'iandanger121@gmail.com'];

// ── Admin PIN (simple second-factor) ────────────────────────────────────────
const ADMIN_PIN = '1984';

// ── Types ────────────────────────────────────────────────────────────────────
interface AdminStats {
  total_users: number;
  total_revenue: number;
  total_paid_out: number;
  pending_withdrawals_count: number;
  pending_withdrawals_total: number;
}

interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  referral_code: string | null;
  referred_by: string | null;
}

interface MiningBalance {
  user_id: string;
  available_balance: number;
  total_earned: number;
  total_withdrawn: number;
  updated_at: string;
}

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'reversed';
  created_at: string;
  failure_reason: string | null;
}

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  description: string;
  plan_name: string | null;
  created_at: string;
}

const STATUS_CFG: Record<string, { label: string; className: string }> = {
  pending:    { label: 'Pending',    className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  processing: { label: 'Processing', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  success:    { label: 'Success',    className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  completed:  { label: 'Completed',  className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  failed:     { label: 'Failed',     className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  reversed:   { label: 'Reversed',   className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
};

const TX_TYPE_COLORS: Record<string, string> = {
  payment:       'text-red-400',
  withdrawal:    'text-orange-400',
  referral_bonus:'text-blue-400',
  task_bonus:    'text-purple-400',
  mining_credit: 'text-green-400',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function shortId(id: string) {
  return id.slice(0, 8) + '…';
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();

  // Gate state
  const [pinInput, setPinInput] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState(false);

  // Data state
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [balances, setBalances] = useState<MiningBalance[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [updatingWithdrawal, setUpdatingWithdrawal] = useState<string | null>(null);

  // Broadcast notice state
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeType, setNoticeType] = useState<'info' | 'warning' | 'success' | 'error'>('info');
  const [activeNotice, setActiveNotice] = useState<{ id: string; message: string; type: string; created_at: string } | null>(null);
  const [sendingNotice, setSendingNotice] = useState(false);
  const [deactivatingNotice, setDeactivatingNotice] = useState(false);
  const [loadingNotice, setLoadingNotice] = useState(false);

  // Search
  const [userSearch, setUserSearch] = useState('');
  const [txSearch, setTxSearch] = useState('');

  const isAdmin = authUser && ADMIN_EMAILS.includes(authUser.email);

  const updateWithdrawalStatus = async (withdrawalId: string, newStatus: 'success' | 'failed') => {
    setUpdatingWithdrawal(withdrawalId + newStatus);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const { data, error } = await supabase.functions.invoke('paystack-transfer', {
        body: { action: 'update_withdrawal_status', withdrawal_id: withdrawalId, new_status: newStatus },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = await error.context?.text() || msg; } catch { /* noop */ }
        }
        toast.error('Failed: ' + msg);
        return;
      }

      toast.success(
        newStatus === 'success'
          ? 'Withdrawal marked as paid successfully'
          : `Withdrawal marked as failed — amount refunded to user's balance`
      );
      // Refresh data to reflect the changes
      await fetchAdminData();
    } catch (err: unknown) {
      toast.error('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setUpdatingWithdrawal(null);
    }
  };

  const fetchActiveNotice = useCallback(async () => {
    setLoadingNotice(true);
    const { data } = await supabase
      .from('notices')
      .select('id, message, type, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveNotice(data ?? null);
    setLoadingNotice(false);
  }, []);

  const handleSendNotice = async () => {
    if (!noticeMessage.trim()) return;
    setSendingNotice(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const { data, error } = await supabase.functions.invoke('paystack-transfer', {
      body: { action: 'manage_notice', sub_action: 'create', message: noticeMessage.trim(), type: noticeType },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) { try { msg = await error.context?.text() || msg; } catch { /* noop */ } }
      toast.error('Failed to publish: ' + msg);
    } else {
      toast.success('Notice published to all users!');
      setNoticeMessage('');
      setActiveNotice(data.notice);
    }
    setSendingNotice(false);
  };

  const handleDeactivateNotice = async () => {
    setDeactivatingNotice(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const { error } = await supabase.functions.invoke('paystack-transfer', {
      body: { action: 'manage_notice', sub_action: 'deactivate' },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) { try { msg = await error.context?.text() || msg; } catch { /* noop */ } }
      toast.error('Failed to deactivate: ' + msg);
    } else {
      toast.success('Notice removed.');
      setActiveNotice(null);
    }
    setDeactivatingNotice(false);
  };

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const { data, error } = await supabase.functions.invoke('paystack-transfer', {
        body: { action: 'admin_stats' },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = await error.context?.text() || msg; } catch { /* noop */ }
        }
        toast.error('Failed to load admin data: ' + msg);
        return;
      }

      setStats(data.stats);
      setProfiles(data.profiles ?? []);
      setBalances(data.balances ?? []);
      setWithdrawals(data.withdrawals ?? []);
      setTransactions(data.transactions ?? []);
    } catch (err: unknown) {
      toast.error('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load data after PIN verified
  useEffect(() => {
    if (pinVerified && isAdmin) {
      fetchAdminData();
      fetchActiveNotice();
    }
  }, [pinVerified, isAdmin, fetchAdminData, fetchActiveNotice]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      setPinVerified(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  // Build merged user rows: profile + balance
  const balanceByUser = Object.fromEntries(balances.map((b) => [b.user_id, b]));
  const mergedUsers = profiles
    .map((p) => ({ ...p, balance: balanceByUser[p.id] ?? null }))
    .filter((u) => {
      const q = userSearch.toLowerCase();
      return !q || u.email.toLowerCase().includes(q) || (u.username ?? '').toLowerCase().includes(q);
    });

  const filteredTx = transactions.filter((t) => {
    const q = txSearch.toLowerCase();
    return !q || t.description.toLowerCase().includes(q) || t.type.includes(q) || t.user_id.includes(q);
  });

  const pendingWithdrawals = withdrawals.filter((w) => w.status === 'pending' || w.status === 'processing');

  // ── Gate: auth still loading ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Verifying session…</p>
        </div>
      </div>
    );
  }

  // ── Gate: not authenticated ───────────────────────────────────────────────
  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-destructive/40">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold">Sign In Required</h2>
            <p className="text-muted-foreground text-sm">
              You must be logged in with an admin account to access this page.
            </p>
            <Button onClick={() => navigate('/login')}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Gate: not an admin email ─────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-destructive/40">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold">Access Denied</h2>
            <p className="text-muted-foreground text-sm">
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{authUser.email}</span> is not on the admin allowlist.
            </p>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Gate: PIN verification ────────────────────────────────────────────────
  if (!pinVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-sm border-primary/30">
          <CardHeader className="text-center space-y-2">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-2xl">Admin Access</CardTitle>
            <p className="text-muted-foreground text-sm">Enter your 4-digit admin PIN to continue</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">Admin PIN</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    placeholder="• • • •"
                    value={pinInput}
                    onChange={(e) => { setPinInput(e.target.value.slice(0, 4)); setPinError(false); }}
                    className={`pl-10 text-center tracking-widest text-xl ${pinError ? 'border-destructive' : ''}`}
                    maxLength={4}
                    autoFocus
                  />
                </div>
                {pinError && (
                  <p className="text-destructive text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Incorrect PIN. Try again.
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={pinInput.length !== 4}>
                <Shield className="mr-2 w-4 h-4" /> Unlock Admin Panel
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main admin dashboard ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen py-10 bg-background">
      <div className="container mx-auto px-4 max-w-7xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Zxt Stocks — Platform Management · <span className="text-primary font-mono">{authUser.email}</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { fetchAdminData(); fetchActiveNotice(); }} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* KPI Strip */}
        {loading && !stats ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              {[
                { label: 'Total Users',    value: stats?.total_users?.toLocaleString() ?? '—',              icon: Users,         color: 'text-blue-400',   bg: 'bg-blue-500/10' },
                { label: 'Total Revenue',  value: stats ? formatCurrency(stats.total_revenue) : '—',        icon: DollarSign,    color: 'text-green-400',  bg: 'bg-green-500/10' },
                { label: 'Total Paid Out', value: stats ? formatCurrency(stats.total_paid_out) : '—',       icon: TrendingUp,    color: 'text-orange-400', bg: 'bg-orange-500/10' },
                { label: 'Pending Payouts', value: stats?.pending_withdrawals_count?.toLocaleString() ?? '—', icon: Clock,      color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                { label: 'Pending Amount', value: stats ? formatCurrency(stats.pending_withdrawals_total) : '—', icon: ArrowDownToLine, color: 'text-red-400', bg: 'bg-red-500/10' },
              ].map((kpi) => (
                <Card key={kpi.label} className="border-border/60">
                  <CardContent className="pt-5 pb-4">
                    <div className={`w-9 h-9 ${kpi.bg} rounded-lg flex items-center justify-center mb-3`}>
                      <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                    </div>
                    <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pending Withdrawals Alert */}
            {pendingWithdrawals.length > 0 && (
              <Card className="mb-8 border-yellow-500/30 bg-yellow-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="w-4 h-4" />
                    {pendingWithdrawals.length} Pending Withdrawal{pendingWithdrawals.length > 1 ? 's' : ''} — {formatCurrency(stats?.pending_withdrawals_total ?? 0)} total
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use the buttons below to manually mark withdrawals after processing them in Paystack or your bank.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Bank</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead>Account No.</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingWithdrawals.map((w) => {
                          const profile = profiles.find((p) => p.id === w.user_id);
                          const cfg = STATUS_CFG[w.status] ?? STATUS_CFG.pending;
                          const isPaidBusy = updatingWithdrawal === w.id + 'success';
                          const isFailBusy = updatingWithdrawal === w.id + 'failed';
                          const isBusy = isPaidBusy || isFailBusy;
                          return (
                            <TableRow key={w.id}>
                              <TableCell>
                                <div className="font-medium text-xs">{profile?.email ?? '—'}</div>
                                <div className="font-mono text-xs text-muted-foreground">{shortId(w.user_id)}</div>
                              </TableCell>
                              <TableCell className="font-bold text-yellow-400">{formatCurrency(w.amount)}</TableCell>
                              <TableCell className="text-sm">{w.bank_name}</TableCell>
                              <TableCell className="text-sm">{w.account_name}</TableCell>
                              <TableCell className="font-mono text-xs">{w.account_number}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{fmt(w.created_at)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs gap-1 border-green-500/40 text-green-400 hover:bg-green-500/10 hover:text-green-300"
                                    onClick={() => updateWithdrawalStatus(w.id, 'success')}
                                    disabled={isBusy}
                                    title="Mark as paid — confirms the transfer was sent"
                                  >
                                    {isPaidBusy ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <BadgeCheck className="w-3 h-3" />
                                    )}
                                    Mark Paid
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                    onClick={() => updateWithdrawalStatus(w.id, 'failed')}
                                    disabled={isBusy}
                                    title="Mark as failed — refunds the amount to user's balance"
                                  >
                                    {isFailBusy ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Ban className="w-3 h-3" />
                                    )}
                                    Mark Failed
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Broadcast Notice Panel */}
            <Card className="mb-8 border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-primary" />
                  Broadcast Message
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Send a platform-wide notice displayed as a banner on every user's dashboard. Only one active notice at a time.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Active notice preview */}
                {loadingNotice ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading active notice…
                  </div>
                ) : activeNotice ? (
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">
                        Active notice · {new Date(activeNotice.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <p className="text-sm font-medium">{activeNotice.message}</p>
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        activeNotice.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                        activeNotice.type === 'success' ? 'bg-green-500/20 text-green-400' :
                        activeNotice.type === 'error'   ? 'bg-red-500/20 text-red-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>{activeNotice.type}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={handleDeactivateNotice}
                      disabled={deactivatingNotice}
                      title="Remove notice"
                    >
                      {deactivatingNotice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground py-1">
                    No active notice. Compose one below to broadcast to all users.
                  </div>
                )}

                {/* Compose new notice */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {(['info', 'warning', 'success', 'error'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setNoticeType(t)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                          noticeType === t
                            ? t === 'warning' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' :
                              t === 'success' ? 'bg-green-500/20 text-green-400 border-green-500/40' :
                              t === 'error'   ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                                               'bg-blue-500/20 text-blue-400 border-blue-500/40'
                            : 'border-border text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type your broadcast message here…"
                      value={noticeMessage}
                      onChange={(e) => setNoticeMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendNotice(); } }}
                      className="flex-1 text-sm"
                      maxLength={280}
                    />
                    <Button
                      size="sm"
                      onClick={handleSendNotice}
                      disabled={sendingNotice || !noticeMessage.trim()}
                      className="shrink-0"
                    >
                      {sendingNotice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                      {sendingNotice ? '' : 'Publish'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{noticeMessage.length}/280 chars · Publishes instantly and replaces any existing notice</p>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="users">
              <TabsList className="mb-6">
                <TabsTrigger value="users" className="gap-2">
                  <Users className="w-4 h-4" /> Users ({profiles.length})
                </TabsTrigger>
                <TabsTrigger value="withdrawals" className="gap-2">
                  <ArrowDownToLine className="w-4 h-4" /> All Withdrawals ({withdrawals.length})
                </TabsTrigger>
                <TabsTrigger value="transactions" className="gap-2">
                  <Activity className="w-4 h-4" /> Transactions ({transactions.length})
                </TabsTrigger>
              </TabsList>

              {/* ── Users Tab ───────────────────────────────────── */}
              <TabsContent value="users">
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Per-User Earnings Breakdown</CardTitle>
                      <Input
                        placeholder="Search by email or name…"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="max-w-xs h-8 text-sm"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Username</TableHead>
                            <TableHead>Referral Code</TableHead>
                            <TableHead>Referred By</TableHead>
                            <TableHead className="text-right">Total Earned</TableHead>
                            <TableHead className="text-right">Available</TableHead>
                            <TableHead className="text-right">Withdrawn</TableHead>
                            <TableHead>Last Active</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mergedUsers.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                No users found
                              </TableCell>
                            </TableRow>
                          ) : mergedUsers.map((u) => (
                            <TableRow key={u.id} className="hover:bg-muted/20">
                              <TableCell>
                                <div className="font-medium text-sm">{u.email}</div>
                                <div className="font-mono text-xs text-muted-foreground">{shortId(u.id)}</div>
                              </TableCell>
                              <TableCell className="text-sm">{u.username ?? '—'}</TableCell>
                              <TableCell>
                                {u.referral_code ? (
                                  <code className="text-xs bg-muted px-2 py-0.5 rounded text-primary">{u.referral_code}</code>
                                ) : '—'}
                              </TableCell>
                              <TableCell>
                                {u.referred_by ? (
                                  <code className="text-xs bg-muted px-2 py-0.5 rounded text-secondary">{u.referred_by}</code>
                                ) : <span className="text-muted-foreground text-xs">organic</span>}
                              </TableCell>
                              <TableCell className="text-right font-bold text-green-400">
                                {u.balance ? formatCurrency(u.balance.total_earned) : <span className="text-muted-foreground text-xs">no plan</span>}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-primary">
                                {u.balance ? formatCurrency(u.balance.available_balance) : '—'}
                              </TableCell>
                              <TableCell className="text-right text-orange-400">
                                {u.balance ? formatCurrency(u.balance.total_withdrawn) : '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {u.balance ? new Date(u.balance.updated_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Withdrawals Tab ─────────────────────────────── */}
              <TabsContent value="withdrawals">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">All Withdrawal Requests</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Bank</TableHead>
                            <TableHead>Account Name</TableHead>
                            <TableHead>Account No.</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {withdrawals.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                No withdrawals yet
                              </TableCell>
                            </TableRow>
                          ) : withdrawals.map((w) => {
                            const profile = profiles.find((p) => p.id === w.user_id);
                            const cfg = STATUS_CFG[w.status] ?? STATUS_CFG.pending;
                            const StatusIcon = w.status === 'success' ? CheckCircle2 : w.status === 'failed' ? XCircle : Clock;
                            return (
                              <TableRow key={w.id}>
                                <TableCell className="text-xs">
                                  <div className="font-medium">{profile?.email ?? '—'}</div>
                                  <div className="font-mono text-muted-foreground">{shortId(w.user_id)}</div>
                                </TableCell>
                                <TableCell className="font-bold">{formatCurrency(w.amount)}</TableCell>
                                <TableCell className="text-sm">{w.bank_name}</TableCell>
                                <TableCell className="text-sm">{w.account_name}</TableCell>
                                <TableCell className="font-mono text-xs">{w.account_number}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`gap-1 text-xs ${cfg.className}`}>
                                    <StatusIcon className="w-3 h-3" />
                                    {cfg.label}
                                  </Badge>
                                  {w.failure_reason && (
                                    <div className="text-xs text-red-400 mt-1">{w.failure_reason}</div>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{fmt(w.created_at)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Transactions Tab ────────────────────────────── */}
              <TabsContent value="transactions">
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Recent Transactions (last 200)</CardTitle>
                      <Input
                        placeholder="Search description or type…"
                        value={txSearch}
                        onChange={(e) => setTxSearch(e.target.value)}
                        className="max-w-xs h-8 text-sm"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTx.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                No transactions found
                              </TableCell>
                            </TableRow>
                          ) : filteredTx.map((t) => {
                            const profile = profiles.find((p) => p.id === t.user_id);
                            const cfg = STATUS_CFG[t.status] ?? STATUS_CFG.pending;
                            const amtColor = TX_TYPE_COLORS[t.type] ?? 'text-foreground';
                            const sign = ['payment', 'withdrawal'].includes(t.type) ? '-' : '+';
                            return (
                              <TableRow key={t.id}>
                                <TableCell className="text-xs">
                                  <div className="font-medium">{profile?.email ?? '—'}</div>
                                  <div className="font-mono text-muted-foreground">{shortId(t.user_id)}</div>
                                </TableCell>
                                <TableCell>
                                  <code className={`text-xs font-mono px-1.5 py-0.5 rounded bg-muted ${amtColor}`}>
                                    {t.type.replace('_', '\u200b_')}
                                  </code>
                                </TableCell>
                                <TableCell className="text-xs max-w-[200px] truncate">{t.description}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{t.plan_name ?? '—'}</TableCell>
                                <TableCell className={`text-right font-bold ${amtColor}`}>
                                  {sign}{formatCurrency(t.amount)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{fmt(t.created_at)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
