import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Zap, Users, Shield, CheckCircle2, ArrowRight } from 'lucide-react';
import { MINING_PLANS } from '@/constants/plans';
import { formatCurrency } from '@/lib/utils';
import { storage } from '@/lib/storage';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();
  const user = storage.getUser();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const features = [
    {
      icon: TrendingUp,
      title: 'Daily Returns',
      description: 'Earn consistent daily profits from your mining operations',
    },
    {
      icon: Zap,
      title: 'Instant Activation',
      description: 'Start mining immediately after payment confirmation',
    },
    {
      icon: Users,
      title: 'Referral Bonuses',
      description: 'Earn extra by inviting friends to join the platform',
    },
    {
      icon: Shield,
      title: 'Secure Platform',
      description: 'Industry-leading security for your investments',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 opacity-50" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1920&q=80')] bg-cover bg-center opacity-5" />
        
        <div className="container mx-auto px-4 py-24 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              Nigeria's Leading Cloud Mining Platform
            </Badge>
            
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              Start Mining Crypto
              <span className="block bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Earn Daily Returns
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join thousands of Nigerians earning passive income through cloud cryptocurrency mining. 
              Pay with Naira, start mining instantly.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" className="px-8 py-6 text-lg" asChild>
                <a href="#pricing">
                  Get Started - ₦3,500
                  <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="px-8 py-6 text-lg" asChild>
                <Link to="/how-it-works">Learn More</Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-12">
              <div className="space-y-2">
                <div className="text-3xl font-bold text-primary">5,000+</div>
                <div className="text-sm text-muted-foreground">Active Miners</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-secondary">₦50M+</div>
                <div className="text-sm text-muted-foreground">Total Paid Out</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-accent">99.9%</div>
                <div className="text-sm text-muted-foreground">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Choose Zxt Stocks?</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Experience the future of cryptocurrency mining with our cutting-edge platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-muted/50 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Choose Your Mining Plan</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Select the perfect plan for your investment goals and start earning today
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {MINING_PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${
                  plan.popular
                    ? 'border-primary shadow-lg shadow-primary/20 scale-105'
                    : 'border-muted/50'
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Most Popular
                  </Badge>
                )}
                
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.duration} Days Mining Period</CardDescription>
                  <div className="pt-4">
                    <div className="text-4xl font-bold text-primary">
                      {formatCurrency(plan.price)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatCurrency(plan.dailyReturn)}/day
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <div className="text-sm text-muted-foreground">Total Return</div>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(plan.totalReturn)}
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    size="lg"
                    asChild
                  >
                    <Link to="/plans">Select Plan</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Start Mining?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of Nigerians already earning daily returns from cryptocurrency mining
          </p>
          <Button size="lg" className="px-12 py-6 text-lg" asChild>
            <a href="#pricing">
              Start Mining Now
              <ArrowRight className="ml-2 w-5 h-5" />
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
