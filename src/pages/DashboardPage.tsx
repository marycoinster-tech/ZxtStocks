import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Wallet, Zap, Users, ArrowUpRight, Clock } from 'lucide-react';
import { storage } from '@/lib/storage';
import { formatCurrency, calculateMiningProgress, getDaysRemaining } from '@/lib/utils';
import { MINING_PLANS } from '@/constants/plans';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = storage.getUser();
  const session = storage.getMiningSession();
  const transactions = storage.getTransactions();
  const referrals = storage.getReferrals();

  const [currentMined, setCurrentMined] = useState(0);
  const [todayEarned, setTodayEarned] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate('/plans');
      return;
    }

    if (session) {
      const plan = MINING_PLANS.find((p) => p.id === session.planId);
      if (plan) {
        // Simulate mining progress
        const interval = setInterval(() => {
          const progress = calculateMiningProgress(session.startDate, session.endDate);
          const totalExpected = plan.totalReturn;
          const mined = (progress / 100) * totalExpected;
          setCurrentMined(mined);

          // Calculate today's earnings
          const daysPassed = Math.floor((Date.now() - new Date(session.startDate).getTime()) / (1000 * 60 * 60 * 24));
          const earned = Math.min(plan.dailyReturn, mined - (daysPassed - 1) * plan.dailyReturn);
          setTodayEarned(Math.max(0, earned));
        }, 1000);

        return () => clearInterval(interval);
      }
    }
  }, [user, session, navigate]);

  if (!user || !session) {
    return null;
  }

  const plan = MINING_PLANS.find((p) => p.id === session.planId);
  if (!plan) return null;

  const progress = calculateMiningProgress(session.startDate, session.endDate);
  const daysRemaining = getDaysRemaining(session.endDate);
  const totalReferralBonus = referrals.reduce((sum, ref) => sum + ref.bonus, 0);

  const stats = [
    {
      title: 'Total Mined',
      value: formatCurrency(currentMined),
      icon: Wallet,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      change: `+${formatCurrency(todayEarned)} today`,
    },
    {
      title: 'Mining Power',
      value: `${plan.hashRate} TH/s`,
      icon: Zap,
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
      change: 'Active',
    },
    {
      title: 'Referral Bonus',
      value: formatCurrency(totalReferralBonus),
      icon: Users,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      change: `${referrals.length} referrals`,
    },
    {
      title: 'Days Remaining',
      value: daysRemaining.toString(),
      icon: Clock,
      color: 'text-info',
      bgColor: 'bg-info/10',
      change: 'of 30 days',
    },
  ];

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-bold mb-2">Welcome back, {user.fullName}!</h1>
            <p className="text-muted-foreground">Here's your mining overview</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`w-10 h-10 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Mining Progress */}
          <Card className="border-primary/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Mining Progress</CardTitle>
                  <CardDescription>{plan.name} - Active</CardDescription>
                </div>
                <Badge variant="default" className="animate-pulse-glow">
                  Mining Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mining Progress</span>
                  <span className="font-medium">{progress.toFixed(2)}%</span>
                </div>
                <div className="relative">
                  <Progress value={progress} className="h-4" />
                  <div className="absolute inset-0 overflow-hidden rounded-full">
                    <div
                      className="h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-mining-progress"
                      style={{ width: '50%' }}
                    />
                  </div>
                </div>
              </div>

              {/* Mining Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">Current Mined</div>
                  <div className="text-xl font-bold text-primary mt-1">
                    {formatCurrency(currentMined)}
                  </div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">Target Return</div>
                  <div className="text-xl font-bold mt-1">
                    {formatCurrency(plan.totalReturn)}
                  </div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">Daily Rate</div>
                  <div className="text-xl font-bold text-secondary mt-1">
                    {formatCurrency(plan.dailyReturn)}
                  </div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">Hash Rate</div>
                  <div className="text-xl font-bold text-accent mt-1">
                    {plan.hashRate} TH/s
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <Button variant="outline" className="flex-1">
                  View Details
                </Button>
                <Button className="flex-1">
                  Withdraw Earnings
                  <ArrowUpRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Your latest activities</CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No transactions yet</p>
                ) : (
                  <div className="space-y-4">
                    {transactions.slice(0, 5).map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${transaction.type === 'payment' ? 'text-destructive' : 'text-success'}`}>
                            {transaction.type === 'payment' ? '-' : '+'}
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </div>
                          <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
                            {transaction.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/transactions')}>
                  View All Transactions
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Referral Program</CardTitle>
                <CardDescription>Invite friends and earn bonuses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="text-sm text-muted-foreground mb-2">Your Referral Code</div>
                  <div className="flex items-center justify-between">
                    <code className="text-2xl font-bold text-primary">{user.referralCode}</code>
                    <Button
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(user.referralCode);
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <div className="text-3xl font-bold text-primary">{referrals.length}</div>
                    <div className="text-sm text-muted-foreground mt-1">Total Referrals</div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <div className="text-3xl font-bold text-success">
                      {formatCurrency(totalReferralBonus)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Total Earned</div>
                  </div>
                </div>

                <Button variant="outline" className="w-full" onClick={() => navigate('/referrals')}>
                  View Referrals
                  <ArrowUpRight className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Upgrade CTA */}
          <Card className="bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 border-primary/30">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Ready to Earn More?</h3>
                  <p className="text-muted-foreground">
                    Upgrade to a higher plan and increase your daily returns
                  </p>
                </div>
                <Button size="lg" onClick={() => navigate('/plans')}>
                  Upgrade Plan
                  <TrendingUp className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
