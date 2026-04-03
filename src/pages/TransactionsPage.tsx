import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  ListTodo,
  Zap,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface DBTransaction {
  id: string;
  type: 'payment' | 'withdrawal' | 'referral_bonus' | 'task_bonus' | 'mining_credit';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  description: string;
  reference: string | null;
  plan_name: string | null;
  created_at: string;
}

const TYPE_META: Record<
  DBTransaction['type'],
  { label: string; icon: React.ElementType; color: string; bg: string; sign: '+' | '-' }
> = {
  payment: {
    label: 'Plan Payment',
    icon: ArrowDownLeft,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    sign: '-',
  },
  withdrawal: {
    label: 'Withdrawal',
    icon: ArrowUpRight,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    sign: '-',
  },
  referral_bonus: {
    label: 'Referral Bonus',
    icon: Users,
    color: 'text-accent',
    bg: 'bg-accent/10',
    sign: '+',
  },
  task_bonus: {
    label: 'Task Bonus',
    icon: ListTodo,
    color: 'text-secondary',
    bg: 'bg-secondary/10',
    sign: '+',
  },
  mining_credit: {
    label: 'Mining Credit',
    icon: Zap,
    color: 'text-primary',
    bg: 'bg-primary/10',
    sign: '+',
  },
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  pending: 'secondary',
  failed: 'destructive',
  reversed: 'outline',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [transactions, setTransactions] = useState<DBTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser) {
      navigate('/login');
      return;
    }
    fetchTransactions();
  }, [authUser, navigate]);

  const fetchTransactions = async () => {
    if (!authUser) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load transactions');
      console.error(error);
    } else {
      setTransactions(data as DBTransaction[]);
    }
    setLoading(false);
  };

  if (!authUser) return null;

  // Summary stats
  const totalPaid = transactions
    .filter((t) => t.type === 'payment' && t.status === 'completed')
    .reduce((s, t) => s + t.amount, 0);
  const totalEarned = transactions
    .filter((t) => ['referral_bonus', 'task_bonus', 'mining_credit'].includes(t.type) && t.status === 'completed')
    .reduce((s, t) => s + t.amount, 0);
  const totalWithdrawn = transactions
    .filter((t) => t.type === 'withdrawal' && t.status !== 'failed')
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Transaction History</h1>
              <p className="text-muted-foreground">
                All payments, withdrawals, and earning credits — synced across devices
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Invested', value: totalPaid, color: 'text-destructive', bg: 'bg-destructive/10' },
              { label: 'Total Earned', value: totalEarned, color: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Total Withdrawn', value: totalWithdrawn, color: 'text-orange-400', bg: 'bg-orange-500/10' },
            ].map((stat) => (
              <Card key={stat.label} className={`border-0 ${stat.bg}`}>
                <CardContent className="pt-5 pb-4">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${stat.color}`}>
                    {loading ? '...' : formatCurrency(stat.value)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Transactions List */}
          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>Complete record of your account activity</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-16">
                  <ArrowDownLeft className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground font-medium mb-2">No transactions yet</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Your payment and earning history will appear here
                  </p>
                  <Button onClick={() => navigate('/plans')}>Purchase a Plan</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const meta = TYPE_META[tx.type] ?? TYPE_META.payment;
                    const Icon = meta.icon;
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 ${meta.bg} rounded-xl flex items-center justify-center shrink-0`}>
                            <Icon className={`w-5 h-5 ${meta.color}`} />
                          </div>
                          <div>
                            <div className="font-medium">{tx.description}</div>
                            {tx.plan_name && (
                              <div className="text-xs text-muted-foreground">{tx.plan_name}</div>
                            )}
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(tx.created_at)}
                            </div>
                            {tx.reference && (
                              <div className="text-xs text-muted-foreground/60 mt-0.5 font-mono">
                                Ref: {tx.reference}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-1 shrink-0">
                          <div className={`text-xl font-bold ${meta.color}`}>
                            {meta.sign}{formatCurrency(tx.amount)}
                          </div>
                          <Badge variant={STATUS_VARIANT[tx.status] ?? 'secondary'}>
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
