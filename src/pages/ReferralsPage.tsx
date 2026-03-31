import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Share2, Gift, CheckCircle2 } from 'lucide-react';
import { storage } from '@/lib/storage';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export default function ReferralsPage() {
  const navigate = useNavigate();
  const user = storage.getUser();
  const referrals = storage.getReferrals();

  useEffect(() => {
    if (!user) {
      navigate('/plans');
    }
  }, [user, navigate]);

  if (!user) return null;

  const totalBonus = referrals.reduce((sum, ref) => sum + ref.bonus, 0);
  const activeReferrals = referrals.filter((ref) => ref.status === 'active').length;

  const handleShare = () => {
    const shareText = `Join me on Zxt Stocks and start mining cryptocurrency! Use my referral code: ${user.referralCode}`;
    const shareUrl = `https://zxtstocks.onspace.app?ref=${user.referralCode}`;

    if (navigator.share) {
      navigator.share({
        title: 'Join Zxt Stocks',
        text: shareText,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success('Referral link copied to clipboard!');
    }
  };

  const benefits = [
    'Earn 10% bonus on every referral payment',
    'Unlimited referral potential',
    'Instant bonus credit',
    'Track all your referrals in real-time',
  ];

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Referral Program</h1>
            <p className="text-muted-foreground">Invite friends and earn extra rewards</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Referrals
                </CardTitle>
                <Users className="w-5 h-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{referrals.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeReferrals} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Earned
                </CardTitle>
                <Gift className="w-5 h-5 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">
                  {formatCurrency(totalBonus)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From referral bonuses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Your Code
                </CardTitle>
                <Share2 className="w-5 h-5 text-accent" />
              </CardHeader>
              <CardContent>
                <code className="text-2xl font-bold text-primary">
                  {user.referralCode}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(user.referralCode);
                    toast.success('Code copied!');
                  }}
                >
                  Copy Code
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* How it Works */}
          <Card className="bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10">
            <CardHeader>
              <CardTitle className="text-2xl">How Referrals Work</CardTitle>
              <CardDescription>Earn bonuses by inviting friends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <ul className="space-y-3">
                    {benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-center">
                  <Button size="lg" onClick={handleShare} className="w-full md:w-auto">
                    <Share2 className="mr-2 w-5 h-5" />
                    Share Referral Link
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Referral List */}
          <Card>
            <CardHeader>
              <CardTitle>Your Referrals</CardTitle>
              <CardDescription>People who joined using your code</CardDescription>
            </CardHeader>
            <CardContent>
              {referrals.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No referrals yet</p>
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
                  {referrals.map((referral) => (
                    <div
                      key={referral.id}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{referral.referredEmail}</div>
                          <div className="text-sm text-muted-foreground">
                            Joined {formatDate(referral.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className="text-xl font-bold text-success">
                          +{formatCurrency(referral.bonus)}
                        </div>
                        <Badge variant={referral.status === 'active' ? 'default' : 'secondary'}>
                          {referral.status}
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
