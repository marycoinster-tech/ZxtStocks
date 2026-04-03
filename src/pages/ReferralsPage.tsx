import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Share2,
  Gift,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Copy,
  ExternalLink,
  Star,
  Crown,
  Zap,
  Award,
  MessageCircle,
  Send,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ReferralBonus {
  id: string;
  referred_email: string;
  plan_id: string;
  plan_name: string;
  bonus_amount: number;
  status: string;
  created_at: string;
}

interface UserProfile {
  referral_code: string | null;
}

const PLAN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  starter: Zap,
  professional: Star,
  elite: Crown,
  enterprise: Award,
};

const PLAN_BONUSES: Record<string, number> = {
  starter: 500,
  professional: 1500,
  elite: 3000,
  enterprise: 5000,
};

export default function ReferralsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [referralBonuses, setReferralBonuses] = useState<ReferralBonus[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [profileRes, bonusRes] = await Promise.all([
      supabase.from('user_profiles').select('referral_code').eq('id', user.id).maybeSingle(),
      supabase
        .from('referral_bonuses')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (bonusRes.data) setReferralBonuses(bonusRes.data);

    setLoading(false);
  };

  if (!user) return null;

  const referralCode = profile?.referral_code || user.referralCode || '—';
  const referralLink = `${window.location.origin}/signup?ref=${referralCode}`;
  const totalBonus = referralBonuses.reduce((sum, r) => sum + r.bonus_amount, 0);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success('Referral code copied!');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!');
  };

  const shareMessage = `🚀 Start earning from crypto mining with Zxt Stocks! Use my referral code: *${referralCode}* and we both earn bonuses. Join here:`;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'Join Zxt Stocks', text: shareMessage, url: referralLink });
    } else {
      navigator.clipboard.writeText(`${shareMessage}\n${referralLink}`);
      toast.success('Share text copied to clipboard!');
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`${shareMessage}\n${referralLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleTwitter = () => {
    const text = encodeURIComponent(`🚀 Earning from crypto mining with Zxt Stocks! Use my code *${referralCode}* to get started and we both earn bonuses. 💰`);
    const url = encodeURIComponent(referralLink);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const handleTelegram = () => {
    const text = encodeURIComponent(shareMessage);
    const url = encodeURIComponent(referralLink);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  };

  const planBonusTiers = [
    { plan: 'Starter', price: '₦3,500', bonus: PLAN_BONUSES.starter, icon: Zap, color: 'text-blue-400' },
    { plan: 'Professional', price: '₦10,000', bonus: PLAN_BONUSES.professional, icon: Star, color: 'text-purple-400' },
    { plan: 'Elite', price: '₦25,000', bonus: PLAN_BONUSES.elite, icon: Crown, color: 'text-yellow-400' },
    { plan: 'Enterprise', price: '₦50,000', bonus: PLAN_BONUSES.enterprise, icon: Award, color: 'text-emerald-400' },
  ];

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-bold mb-2">Referral Program</h1>
            <p className="text-muted-foreground">Invite friends and earn bonuses when they purchase a plan</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Earned</CardTitle>
                <Gift className="w-5 h-5 text-primary" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <>
                    <div className="text-3xl font-bold text-primary">{formatCurrency(totalBonus)}</div>
                    <p className="text-xs text-muted-foreground mt-1">From referral bonuses</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Referrals</CardTitle>
                <Users className="w-5 h-5 text-blue-400" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <div className="text-3xl font-bold">{referralBonuses.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Successful referrals</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Your Code</CardTitle>
                <Share2 className="w-5 h-5 text-accent" />
              </CardHeader>
              <CardContent>
                <code className="text-2xl font-bold text-primary tracking-wider">{referralCode}</code>
                <Button size="sm" variant="outline" className="mt-2 w-full gap-2" onClick={handleCopyCode}>
                  <Copy className="w-3 h-3" /> Copy Code
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Referral Link & Share */}
          <Card className="bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl">Share Your Referral Link</CardTitle>
              <CardDescription>Copy your link and share it with friends — earn instantly when they pay</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 bg-background/60 border border-border rounded-lg px-4 py-3 text-sm font-mono truncate">
                  {referralLink}
                </div>
                <Button variant="outline" onClick={handleCopyLink} className="shrink-0">
                  <Copy className="w-4 h-4 mr-2" /> Copy
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* WhatsApp */}
                <Button
                  size="lg"
                  onClick={handleWhatsApp}
                  className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] text-white border-0"
                >
                  <MessageCircle className="mr-2 w-4 h-4" />
                  WhatsApp
                </Button>

                {/* Twitter / X */}
                <Button
                  size="lg"
                  onClick={handleTwitter}
                  className="flex-1 bg-[#1DA1F2] hover:bg-[#1a91da] text-white border-0"
                >
                  {/* X (Twitter) icon via SVG */}
                  <svg className="mr-2 w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Twitter/X
                </Button>

                {/* Telegram */}
                <Button
                  size="lg"
                  onClick={handleTelegram}
                  className="flex-1 bg-[#0088CC] hover:bg-[#007ab8] text-white border-0"
                >
                  <Send className="mr-2 w-4 h-4" />
                  Telegram
                </Button>

                {/* Copy Link */}
                <Button size="lg" variant="outline" className="flex-1" onClick={handleCopyLink}>
                  <Copy className="mr-2 w-4 h-4" />
                  Copy Link
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Bonus Tiers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Bonus Tiers Per Plan
              </CardTitle>
              <CardDescription>You earn this bonus when your referral completes their plan payment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {planBonusTiers.map((tier) => (
                  <div key={tier.plan} className="p-4 bg-muted/40 rounded-xl text-center border border-border hover:border-primary/40 transition-colors">
                    <tier.icon className={`w-8 h-8 mx-auto mb-2 ${tier.color}`} />
                    <div className="font-semibold text-sm">{tier.plan}</div>
                    <div className="text-xs text-muted-foreground mb-2">{tier.price} plan</div>
                    <div className="text-xl font-bold text-primary">{formatCurrency(tier.bonus)}</div>
                    <div className="text-xs text-muted-foreground">you earn</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { step: '1', title: 'Share Your Code', desc: 'Send your referral link or code to friends via WhatsApp, social media, or anywhere.' },
                  { step: '2', title: 'Friend Signs Up', desc: 'Your friend registers using your referral code during signup.' },
                  { step: '3', title: 'Earn Instantly', desc: 'When they purchase any plan, you get credited instantly based on the tier.' },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 font-bold text-primary">
                      {item.step}
                    </div>
                    <div>
                      <div className="font-semibold mb-1">{item.title}</div>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Referral History */}
          <Card>
            <CardHeader>
              <CardTitle>Referral History</CardTitle>
              <CardDescription>People who signed up and paid using your code</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : referralBonuses.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground mb-2 font-medium">No referrals yet</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Share your referral code and start earning bonuses
                  </p>
                  <Button onClick={handleShare}>
                    <Share2 className="mr-2 w-4 h-4" />
                    Share Now
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {referralBonuses.map((bonus) => {
                    const PlanIcon = PLAN_ICONS[bonus.plan_id] || Zap;
                    return (
                      <div
                        key={bonus.id}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <PlanIcon className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{bonus.referred_email}</div>
                            <div className="text-sm text-muted-foreground">{bonus.plan_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(bonus.created_at).toLocaleDateString('en-NG', {
                                day: 'numeric', month: 'short', year: 'numeric'
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-xl font-bold text-primary">
                            +{formatCurrency(bonus.bonus_amount)}
                          </div>
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {bonus.status}
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
