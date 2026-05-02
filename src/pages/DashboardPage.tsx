import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Wallet, Zap, Users, ArrowUpRight, CheckCircle2, ListChecks, Loader2, Lock, Coins, X, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { storage } from '@/lib/storage';
import { formatCurrency, calculateMiningProgress, getDaysRemaining } from '@/lib/utils';
import { MINING_PLANS } from '@/constants/plans';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';

// ── Task definitions per plan ────────────────────────────────────────────────
const TASKS_BY_PLAN: Record<string, { key: string; title: string; description: string; bonus: number }[]> = {
  starter: [
    { key: 'watch_tutorial', title: 'Watch Mining Tutorial', description: 'Watch the 2-min intro video on how cloud mining works', bonus: 50 },
    { key: 'share_referral', title: 'Share Referral Code', description: 'Share your referral link with at least one contact', bonus: 100 },
    { key: 'complete_profile', title: 'Complete Your Profile', description: 'Add your display name and verify email', bonus: 50 },
    { key: 'first_login', title: 'Daily Login Streak (Day 1)', description: 'Log in for your first day on the platform', bonus: 50 },
    { key: 'read_faq', title: 'Read the FAQ', description: 'Visit the How It Works page and read the FAQ section', bonus: 50 },
    { key: 'explore_plans', title: 'Explore Mining Plans', description: 'Browse all available mining plans', bonus: 50 },
    { key: 'join_community', title: 'Join Our Community', description: 'Follow us on social media for mining tips and updates', bonus: 50 },
    { key: 'withdraw_check', title: 'Explore Withdrawals', description: 'Visit the withdrawal page and review how payouts work', bonus: 50 },
    { key: 'invite_friend', title: 'Invite a Friend', description: 'Successfully invite a friend who creates an account', bonus: 100 },
    { key: 'streak_7', title: '7-Day Login Streak', description: 'Log in for 7 consecutive days to earn this milestone bonus', bonus: 250 },
  ],
  professional: [
    { key: 'watch_tutorial', title: 'Watch Mining Tutorial', description: 'Watch the intro video on how cloud mining works', bonus: 150 },
    { key: 'share_referral', title: 'Share Referral Code', description: 'Share your referral link with at least 3 contacts', bonus: 300 },
    { key: 'complete_profile', title: 'Complete Your Profile', description: 'Verify your profile details and email', bonus: 150 },
    { key: 'first_login', title: 'Daily Login Streak (Day 1)', description: 'Log in for your first day on the platform', bonus: 150 },
    { key: 'read_faq', title: 'Read the FAQ', description: 'Visit and read the full How It Works guide', bonus: 100 },
    { key: 'explore_plans', title: 'Explore Mining Plans', description: 'Review all mining plan tiers and compare features', bonus: 100 },
    { key: 'join_community', title: 'Join Our Community', description: 'Follow Zxt Stocks on social channels', bonus: 150 },
    { key: 'withdraw_check', title: 'Setup Withdrawal', description: 'Add your bank account on the withdrawal page', bonus: 100 },
    { key: 'invite_friend', title: 'Invite 2 Friends', description: 'Successfully refer 2 friends who create accounts', bonus: 300 },
    { key: 'streak_7', title: '7-Day Login Streak', description: 'Log in 7 consecutive days for a streak bonus', bonus: 500 },
    { key: 'streak_14', title: '14-Day Login Streak', description: 'Log in 14 consecutive days for a bigger bonus', bonus: 750 },
    { key: 'share_earnings', title: 'Share Your Earnings', description: 'Post a screenshot of your earnings on social media', bonus: 200 },
    { key: 'refer_premium', title: 'Refer a Premium User', description: 'Refer someone who purchases the Elite or Enterprise plan', bonus: 500 },
    { key: 'first_withdrawal', title: 'Make Your First Withdrawal', description: 'Complete your first successful withdrawal request', bonus: 200 },
    { key: 'plan_review', title: 'Leave a Plan Review', description: 'Submit feedback on your mining experience', bonus: 100 },
    // Fill to 30
    ...Array.from({ length: 15 }, (_, i) => ({
      key: `bonus_task_${i + 1}`,
      title: `Bonus Mining Task ${i + 1}`,
      description: `Complete mining bonus activity ${i + 1} to earn extra rewards`,
      bonus: 100,
    })),
  ],
  elite: [
    { key: 'watch_tutorial', title: 'Watch Mining Tutorial', description: 'Watch the advanced mining overview video', bonus: 400 },
    { key: 'share_referral', title: 'Share Referral Code', description: 'Share your link with 5+ contacts', bonus: 600 },
    { key: 'complete_profile', title: 'Complete Your Profile', description: 'Fully verify your profile', bonus: 400 },
    { key: 'first_login', title: 'Daily Login Streak (Day 1)', description: 'First day login bonus', bonus: 300 },
    { key: 'streak_7', title: '7-Day Streak', description: 'Maintain 7-day login streak', bonus: 1000 },
    { key: 'streak_14', title: '14-Day Streak', description: 'Maintain 14-day login streak', bonus: 1500 },
    { key: 'streak_30', title: '30-Day Streak', description: 'Complete the full 30-day mining period daily', bonus: 3000 },
    { key: 'invite_5', title: 'Invite 5 Friends', description: 'Refer 5 friends who register', bonus: 1000 },
    { key: 'first_withdrawal', title: 'First Withdrawal', description: 'Complete your first successful withdrawal', bonus: 500 },
    { key: 'share_earnings', title: 'Share Earnings Screenshot', description: 'Share your mining stats on social media', bonus: 400 },
    // Fill to 60
    ...Array.from({ length: 50 }, (_, i) => ({
      key: `elite_task_${i + 1}`,
      title: `Elite Mining Task ${i + 1}`,
      description: `Complete elite bonus activity ${i + 1} to earn your daily reward`,
      bonus: 200,
    })),
  ],
  enterprise: [
    { key: 'watch_tutorial', title: 'Watch Mining Tutorial', description: 'Watch the enterprise mining mastery video', bonus: 1000 },
    { key: 'share_referral', title: 'Share Referral Code', description: 'Share your link with 10+ contacts', bonus: 2000 },
    { key: 'complete_profile', title: 'Complete Your Profile', description: 'Fully verify enterprise profile', bonus: 1000 },
    { key: 'first_login', title: 'Daily Login Streak (Day 1)', description: 'First day login bonus', bonus: 500 },
    { key: 'streak_7', title: '7-Day Streak', description: 'Maintain 7-day login streak', bonus: 2000 },
    { key: 'streak_14', title: '14-Day Streak', description: 'Maintain 14-day login streak', bonus: 3000 },
    { key: 'streak_30', title: '30-Day Streak', description: 'Complete the full 30-day period daily', bonus: 7000 },
    { key: 'invite_10', title: 'Invite 10 Friends', description: 'Refer 10 friends who register', bonus: 3000 },
    { key: 'first_withdrawal', title: 'First Withdrawal', description: 'Complete your first withdrawal', bonus: 1000 },
    { key: 'share_earnings', title: 'Share Earnings Screenshot', description: 'Share your mining stats publicly', bonus: 1000 },
    // Fill to 100
    ...Array.from({ length: 90 }, (_, i) => ({
      key: `enterprise_task_${i + 1}`,
      title: `Enterprise Task ${i + 1}`,
      description: `Complete enterprise bonus activity ${i + 1} for premium rewards`,
      bonus: 500,
    })),
  ],
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
        errorMessage = `[Code: ${statusCode}] ${textContent || error.message}`;
      } catch {
        errorMessage = error.message || 'Unknown error';
      }
    }
    throw new Error(errorMessage);
  }
  return data;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const user = storage.getUser();
  const session = storage.getMiningSession();
  const transactions = storage.getTransactions();
  const referrals = storage.getReferrals();

  const [currentMined, setCurrentMined] = useState(0);
  const [todayEarned, setTodayEarned] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [claimingTask, setClaimingTask] = useState<string | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Real DB balance state
  const [dbBalance, setDbBalance] = useState<{
    available_balance: number;
    total_earned: number;
    total_withdrawn: number;
  } | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);

  // Daily mining claim state
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [todayAlreadyClaimed, setTodayAlreadyClaimed] = useState(false);

  // Platform notices
  const [notices, setNotices] = useState<{ id: string; message: string; type: string }[]>([]);
  const [dismissedNotices, setDismissedNotices] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dismissed_notices') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    const fetchNotices = async () => {
      const { data } = await supabase.from('notices').select('id, message, type').eq('is_active', true);
      if (data) setNotices(data);
    };
    fetchNotices();
  }, []);

  useEffect(() => {
    if (!user && !authUser) {
      navigate('/plans');
      return;
    }

    if (session) {
      const plan = MINING_PLANS.find((p) => p.id === session.planId);
      if (plan) {
        const interval = setInterval(() => {
          const progress = calculateMiningProgress(session.startDate, session.endDate);
          const totalExpected = plan.totalReturn;
          const mined = (progress / 100) * totalExpected;
          setCurrentMined(mined);
          const daysPassed = Math.floor((Date.now() - new Date(session.startDate).getTime()) / (1000 * 60 * 60 * 24));
          const earned = Math.min(plan.dailyReturn, mined - (daysPassed - 1) * plan.dailyReturn);
          setTodayEarned(Math.max(0, earned));
        }, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [user, authUser, session, navigate]);

  // Fetch real mining balance from Supabase
  useEffect(() => {
    const fetchBalance = async () => {
      if (!authUser) { setLoadingBalance(false); return; }
      const { data, error } = await supabase
        .from('mining_balances')
        .select('available_balance, total_earned, total_withdrawn, last_claimed_at')
        .eq('user_id', authUser.id)
        .maybeSingle();
      if (!error && data) {
        setDbBalance(data);
        const todayUTC = new Date().toISOString().slice(0, 10);
        setTodayAlreadyClaimed((data as any).last_claimed_at === todayUTC);
      }
      setLoadingBalance(false);
    };
    fetchBalance();
  }, [authUser]);

  // Load completed tasks from DB
  useEffect(() => {
    const fetchTasks = async () => {
      if (!authUser) { setLoadingTasks(false); return; }
      const { data } = await supabase
        .from('user_tasks')
        .select('task_key')
        .eq('user_id', authUser.id);
      if (data) setCompletedTasks(data.map((t) => t.task_key));
      setLoadingTasks(false);
    };
    fetchTasks();
  }, [authUser]);

  const handleClaimDaily = async () => {
    if (!authUser || !session?.planId) return;
    setClaimingDaily(true);
    try {
      const result = await callEdgeFunction('credit_daily_mining', {
        user_id: authUser.id,
        plan_id: session.planId,
      });
      setTodayAlreadyClaimed(true);
      setDbBalance((prev) => prev ? {
        ...prev,
        available_balance: result.new_balance,
        total_earned: prev.total_earned + result.amount_credited,
      } : prev);
      toast.success(`+${formatCurrency(result.amount_credited)} mining credit added to your balance!`);
    } catch (error: any) {
      const msg: string = error.message || 'Failed to claim';
      if (msg.includes('Already claimed')) {
        setTodayAlreadyClaimed(true);
        toast.info("You've already claimed today's earnings. Come back tomorrow!");
      } else {
        toast.error(msg);
      }
    } finally {
      setClaimingDaily(false);
    }
  };

  const dismissNotice = (id: string) => {
    const next = new Set([...dismissedNotices, id]);
    setDismissedNotices(next);
    localStorage.setItem('dismissed_notices', JSON.stringify([...next]));
  };

  const handleClaimTask = async (task: { key: string; title: string; description: string; bonus: number }) => {
    if (!authUser) return;
    setClaimingTask(task.key);
    try {
      await callEdgeFunction('complete_task', {
        user_id: authUser.id,
        task_key: task.key,
        task_title: task.title,
        task_description: task.description,
        bonus_amount: task.bonus,
      });
      setCompletedTasks((prev) => [...prev, task.key]);
      toast.success(`Task completed! +${formatCurrency(task.bonus)} credited to your balance`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to claim task');
    } finally {
      setClaimingTask(null);
    }
  };

  if (!user && !authUser) return null;

  const displayName = authUser?.fullName || user?.fullName || 'Miner';
  const plan = session ? MINING_PLANS.find((p) => p.id === session.planId) : null;
  const progress = session ? calculateMiningProgress(session.startDate, session.endDate) : 0;
  const daysRemaining = session ? getDaysRemaining(session.endDate) : 0;
  const totalReferralBonus = referrals.reduce((sum, ref) => sum + ref.bonus, 0);

  // Tasks for active plan
  const activePlanId = session?.planId || 'starter';
  const planTasks = TASKS_BY_PLAN[activePlanId] || TASKS_BY_PLAN.starter;
  const taskQuota = plan?.monthlyTasks || 10;
  const visibleTasks = planTasks.slice(0, taskQuota);
  const completedCount = visibleTasks.filter((t) => completedTasks.includes(t.key)).length;
  const taskProgress = taskQuota > 0 ? (completedCount / taskQuota) * 100 : 0;

  // ── BALANCE DISPLAY: prefer real DB balance, fall back to localStorage mining progress ──
  // DB available balance (withdrawable earnings + task bonuses + referral bonuses)
  const liveAvailableBalance = dbBalance?.available_balance ?? 0;
  const liveTotalEarned = dbBalance?.total_earned ?? 0;
  const liveTotalWithdrawn = dbBalance?.total_withdrawn ?? 0;

  const stats = [
    {
      title: 'Total Earned',
      value: loadingBalance ? '...' : formatCurrency(liveTotalEarned),
      icon: Wallet,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      change: loadingBalance ? 'Loading...' : (plan ? `+${formatCurrency(plan.dailyReturn)}/day` : 'Purchase a plan'),
    },
    {
      title: 'Available Balance',
      value: loadingBalance ? '...' : formatCurrency(liveAvailableBalance),
      icon: TrendingUp,
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
      change: loadingBalance ? 'Loading...' : (plan ? 'Withdrawable now' : 'No active plan'),
    },
    {
      title: 'Total Withdrawn',
      value: loadingBalance ? '...' : formatCurrency(liveTotalWithdrawn),
      icon: Users,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      change: 'All time payouts',
    },
    {
      title: 'Mining Hash Rate',
      value: plan ? `${plan.hashRate} TH/s` : '— TH/s',
      icon: Zap,
      color: 'text-info',
      bgColor: 'bg-info/10',
      change: plan ? `${daysRemaining} days remaining` : '—',
    },
  ];

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Platform Notices Banner */}
          {notices.filter((n) => !dismissedNotices.has(n.id)).map((notice) => {
            const cfgMap: Record<string, { bg: string; border: string; text: string; Icon: React.ElementType }> = {
              info:    { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-300',   Icon: Info },
              warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-300', Icon: AlertTriangle },
              success: { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-300',  Icon: CheckCircle },
              error:   { bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-300',    Icon: XCircle },
            };
            const cfg = cfgMap[notice.type] ?? cfgMap.info;
            return (
              <div key={notice.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${cfg.bg} ${cfg.border}`}>
                <cfg.Icon className={`w-5 h-5 shrink-0 mt-0.5 ${cfg.text}`} />
                <p className={`flex-1 text-sm font-medium leading-relaxed ${cfg.text}`}>{notice.message}</p>
                <button
                  onClick={() => dismissNotice(notice.id)}
                  className={`shrink-0 ${cfg.text} opacity-70 hover:opacity-100 transition-opacity`}
                  aria-label="Dismiss notice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          {/* Header */}
          <div>
            <h1 className="text-4xl font-bold mb-2">Welcome back, {displayName}!</h1>
            <p className="text-muted-foreground">Here's your mining overview</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
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
          {plan && session ? (
            <Card className="border-primary/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Mining Progress</CardTitle>
                    <CardDescription>{plan.name} - Active</CardDescription>
                  </div>
                  <Badge variant="default" className="animate-pulse-glow">Mining Active</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Mining Progress</span>
                    <span className="font-medium">{progress.toFixed(2)}%</span>
                  </div>
                  <div className="relative">
                    <Progress value={progress} className="h-4" />
                    <div className="absolute inset-0 overflow-hidden rounded-full">
                      <div className="h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-mining-progress" style={{ width: '50%' }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Current Mined', value: formatCurrency(currentMined), color: 'text-primary' },
                    { label: 'Target Return', value: formatCurrency(plan.totalReturn), color: '' },
                    { label: 'Daily Rate', value: formatCurrency(plan.dailyReturn), color: 'text-secondary' },
                    { label: 'Hash Rate', value: `${plan.hashRate} TH/s`, color: 'text-accent' },
                  ].map((item) => (
                    <div key={item.label} className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">{item.label}</div>
                      <div className={`text-xl font-bold mt-1 ${item.color}`}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* Daily Claim Button */}
                <div className={`flex items-center justify-between rounded-xl border p-4 ${
                  todayAlreadyClaimed
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-primary/5 border-primary/20'
                }`}>
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <Coins className="w-4 h-4 text-primary" />
                      Today's Mining Earnings
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {todayAlreadyClaimed
                        ? 'Claimed — come back tomorrow for your next credit'
                        : `Click to claim your ${formatCurrency(plan.dailyReturn)} for today`}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={todayAlreadyClaimed ? 'outline' : 'default'}
                    onClick={handleClaimDaily}
                    disabled={claimingDaily || todayAlreadyClaimed}
                    className="shrink-0 min-w-[130px]"
                  >
                    {claimingDaily ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Claiming…</>
                    ) : todayAlreadyClaimed ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 mr-2 text-green-500" />Claimed</>
                    ) : (
                      <><Coins className="w-3.5 h-3.5 mr-2" />Claim {formatCurrency(plan.dailyReturn)}</>
                    )}
                  </Button>
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" className="flex-1">View Details</Button>
                  <Button className="flex-1" onClick={() => navigate('/withdraw')}>
                    Withdraw Earnings <ArrowUpRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-primary/30">
              <CardContent className="py-16 text-center">
                <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground mb-4">No active mining plan. Purchase a plan to start earning.</p>
                <Button onClick={() => navigate('/plans')}>View Plans</Button>
              </CardContent>
            </Card>
          )}

          {/* ── TASKS SECTION ─────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <ListChecks className="w-6 h-6 text-primary" />
                    Monthly Tasks
                  </CardTitle>
                  <CardDescription>
                    Complete tasks to earn bonus mining rewards · {plan?.name || 'Starter Plan'}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{completedCount}/{taskQuota}</div>
                  <div className="text-xs text-muted-foreground">tasks completed</div>
                </div>
              </div>

              {/* Task progress bar */}
              <div className="space-y-1 pt-2">
                <Progress value={taskProgress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{completedCount} completed</span>
                  <span>{taskQuota - completedCount} remaining</span>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loadingTasks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {visibleTasks.map((task) => {
                    const isDone = completedTasks.includes(task.key);
                    const isClaiming = claimingTask === task.key;
                    const isLocked = !plan;

                    return (
                      <div
                        key={task.key}
                        className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                          isDone
                            ? 'bg-green-500/5 border-green-500/20 opacity-70'
                            : isLocked
                            ? 'bg-muted/20 border-border opacity-50'
                            : 'bg-muted/30 border-border hover:border-primary/40'
                        }`}
                      >
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center ${
                          isDone ? 'bg-green-500/20' : 'bg-primary/10'
                        }`}>
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : isLocked ? (
                            <Lock className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ListChecks className="w-5 h-5 text-primary" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm leading-tight">{task.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{task.description}</div>
                          <div className="text-xs font-semibold text-primary mt-1">+{formatCurrency(task.bonus)}</div>
                        </div>

                        {/* Action */}
                        <div className="shrink-0">
                          {isDone ? (
                            <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-xs">
                              Done
                            </Badge>
                          ) : isLocked ? (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Locked
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 px-3"
                              onClick={() => handleClaimTask(task)}
                              disabled={isClaiming}
                            >
                              {isClaiming ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                'Claim'
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity & Referrals */}
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
                      <div key={transaction.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="text-sm text-muted-foreground">{new Date(transaction.createdAt).toLocaleDateString()}</div>
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
                    <code className="text-2xl font-bold text-primary tracking-wider">
                      {authUser?.referralCode || user?.referralCode || '—'}
                    </code>
                    <Button
                      size="sm"
                      onClick={() => {
                        const code = authUser?.referralCode || user?.referralCode || '';
                        navigator.clipboard.writeText(code);
                        toast.success('Referral code copied!');
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
                    <div className="text-3xl font-bold text-success">{formatCurrency(totalReferralBonus)}</div>
                    <div className="text-sm text-muted-foreground mt-1">Total Earned</div>
                  </div>
                </div>

                <Button variant="outline" className="w-full" onClick={() => navigate('/referrals')}>
                  View Referrals <ArrowUpRight className="ml-2 w-4 h-4" />
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
                  <p className="text-muted-foreground">Upgrade to a higher plan and increase your daily returns</p>
                </div>
                <Button size="lg" onClick={() => navigate('/plans')}>
                  Upgrade Plan <TrendingUp className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
