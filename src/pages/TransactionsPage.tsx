import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDownLeft, ArrowUpRight, Users } from 'lucide-react';
import { storage } from '@/lib/storage';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function TransactionsPage() {
  const navigate = useNavigate();
  const user = storage.getUser();
  const transactions = storage.getTransactions();

  useEffect(() => {
    if (!user) {
      navigate('/plans');
    }
  }, [user, navigate]);

  if (!user) return null;

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return <ArrowDownLeft className="w-5 h-5 text-destructive" />;
      case 'withdrawal':
        return <ArrowUpRight className="w-5 h-5 text-success" />;
      case 'referral':
        return <Users className="w-5 h-5 text-accent" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Transaction History</h1>
            <p className="text-muted-foreground">View all your payments, withdrawals, and referral bonuses</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>Complete record of your account activity</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No transactions yet</p>
                  <p className="text-sm text-muted-foreground">
                    Your transaction history will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                          {getTransactionIcon(transaction.type)}
                        </div>
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(transaction.createdAt)}
                          </div>
                          {transaction.reference && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Ref: {transaction.reference}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div
                          className={`text-xl font-bold ${
                            transaction.type === 'payment'
                              ? 'text-destructive'
                              : 'text-success'
                          }`}
                        >
                          {transaction.type === 'payment' ? '-' : '+'}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </div>
                        <Badge variant={getStatusColor(transaction.status)}>
                          {transaction.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
