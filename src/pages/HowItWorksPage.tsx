import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  Cpu, 
  TrendingUp, 
  Wallet, 
  Shield, 
  Zap, 
  Users, 
  CheckCircle2,
  ArrowRight,
  Clock,
  DollarSign,
  Server
} from 'lucide-react';

export default function HowItWorksPage() {
  const steps = [
    {
      number: '01',
      icon: Wallet,
      title: 'Choose Your Plan',
      description: 'Select a mining plan that fits your budget. Plans start from ₦3,500 with different mining durations and hash rates.',
      details: ['Starter: ₦3,500 — ₦500/day + 10 tasks/month', 'Professional: ₦10,000 — ₦1,500/day + 30 tasks/month', 'Elite: ₦25,000 — ₦4,000/day + 60 tasks/month', 'Enterprise: ₦50,000 — ₦10,000/day + 100 tasks/month']
    },
    {
      number: '02',
      icon: DollarSign,
      title: 'Make Payment',
      description: 'Pay securely with your debit card using Paystack. We accept all Nigerian cards and bank transfers.',
      details: ['Instant payment processing', 'Secure encryption', 'Payment confirmation via email']
    },
    {
      number: '03',
      icon: Zap,
      title: 'Mining Starts Automatically',
      description: 'Once payment is confirmed, our powerful mining rigs start working for you immediately. No setup required.',
      details: ['Instant activation', 'Real-time hash rate allocation', '24/7 mining operations']
    },
    {
      number: '04',
      icon: TrendingUp,
      title: 'Earn Daily Returns',
      description: 'Watch your earnings grow every day. Returns are calculated based on your plan and credited to your account.',
      details: ['Daily profit updates', 'Compound your earnings', 'Track performance in real-time']
    },
    {
      number: '05',
      icon: Wallet,
      title: 'Withdraw Anytime',
      description: 'Cash out your earnings to your bank account or crypto wallet whenever you want. No hidden fees or restrictions.',
      details: ['Instant withdrawals', 'Multiple payout options', 'No minimum withdrawal limit']
    }
  ];

  const benefits = [
    {
      icon: Cpu,
      title: 'Industrial-Grade Equipment',
      description: 'We use latest ASIC miners with maximum efficiency and uptime'
    },
    {
      icon: Shield,
      title: 'Secure & Transparent',
      description: 'All transactions are encrypted and mining stats are visible in real-time'
    },
    {
      icon: Server,
      title: 'No Technical Knowledge',
      description: 'We handle all the technical work - you just earn and withdraw'
    },
    {
      icon: Clock,
      title: 'Passive Income',
      description: 'Earn money while you sleep - mining runs 24/7 automatically'
    },
    {
      icon: Users,
      title: 'Referral Bonuses',
      description: 'Earn extra by inviting friends - up to 20% commission on their plans'
    },
    {
      icon: Zap,
      title: 'Instant Activation',
      description: 'Start earning within minutes of payment confirmation'
    }
  ];

  const faqs = [
    {
      question: 'What is crypto mining?',
      answer: 'Cryptocurrency mining is the process of verifying transactions on blockchain networks using computational power. Miners are rewarded with cryptocurrency for their work. With Zxt Stocks, you rent our mining equipment to earn these rewards without buying or managing hardware yourself.'
    },
    {
      question: 'How do I earn money?',
      answer: 'You purchase a mining plan, and our equipment mines cryptocurrency on your behalf 24/7 for 30 days. Daily returns are fixed per plan — ₦500/day on Starter up to ₦10,000/day on Enterprise. You also get monthly task bonuses to boost earnings. Withdraw your balance anytime directly to your Nigerian bank account.'
    },
    {
      question: 'Is it safe?',
      answer: 'Yes! We use Paystack for secure payments (the same system used by major Nigerian companies), and all mining operations are monitored 24/7. Your earnings are tracked transparently, and you have full control over withdrawals.'
    },
    {
      question: 'What happens after my plan expires?',
      answer: 'You can withdraw all your earnings and choose to renew your plan, upgrade to a higher tier, or simply cash out. There are no automatic renewals - you have complete control.'
    },
    {
      question: 'Can I withdraw my earnings before the plan ends?',
      answer: 'Absolutely! You can withdraw your accumulated earnings at any time during your mining period. Your mining continues running even after withdrawals.'
    },
    {
      question: 'How long does withdrawal take?',
      answer: 'Bank withdrawals are processed within 24 hours on business days. Crypto withdrawals are typically instant depending on network conditions.'
    }
  ];

  return (
    <div className="min-h-screen py-12">
      {/* Hero */}
      <section className="container mx-auto px-4 mb-16">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-5xl font-bold leading-tight">
            How Cloud Mining
            <span className="block bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Works at Zxt Stocks
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Earn passive income from cryptocurrency mining without buying expensive hardware or technical knowledge
          </p>
        </div>
      </section>

      {/* What is Cloud Mining */}
      <section className="container mx-auto px-4 mb-16">
        <Card className="max-w-4xl mx-auto border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
          <CardHeader>
            <CardTitle className="text-3xl">What is Cloud Mining?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-lg leading-relaxed">
            <p>
              <strong>Cloud mining</strong> allows you to mine cryptocurrency without owning physical mining equipment. 
              Instead of buying expensive mining rigs (which can cost millions of naira), paying for electricity, 
              and dealing with noise and heat, you simply rent mining power from us.
            </p>
            <p>
              We own and operate <strong>industrial-scale mining farms</strong> with the latest equipment. When you purchase 
              a plan, you're renting a portion of this mining power. Our equipment mines cryptocurrency 24/7, and you 
              receive daily returns based on your plan.
            </p>
            <div className="bg-primary/10 p-6 rounded-lg border border-primary/20">
              <p className="font-semibold text-primary mb-2">Think of it like this:</p>
              <p>
                Instead of buying your own taxi (₦5M+), you invest as little as ₦3,500 to rent professional mining power that earns you ₦500 every single day for 30 days — that's ₦15,000 total return from a ₦3,500 investment. Higher plans earn even more daily. That's exactly how cloud mining works!
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* How It Works Steps */}
      <section className="container mx-auto px-4 mb-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Simple 5-Step Process</h2>
            <p className="text-muted-foreground text-lg">
              Start earning in less than 5 minutes
            </p>
          </div>

          <div className="space-y-8">
            {steps.map((step, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-1/4 bg-gradient-to-br from-primary/20 to-secondary/20 p-8 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl font-bold text-primary/30 mb-4">{step.number}</div>
                      <step.icon className="w-16 h-16 text-primary mx-auto" />
                    </div>
                  </div>
                  <div className="md:w-3/4 p-8">
                    <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground text-lg mb-4">{step.description}</p>
                    <ul className="space-y-2">
                      {step.details.map((detail, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Why Choose Us?</h2>
              <p className="text-muted-foreground text-lg">
                Nigeria's most trusted cloud mining platform
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((benefit, index) => (
                <Card key={index} className="border-muted/50 hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <benefit.icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle>{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground text-lg">
              Everything you need to know about cloud mining
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-xl">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-gradient-to-br from-primary/20 to-secondary/20 border-primary/20">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl mb-2">Ready to Start Mining?</CardTitle>
            <CardDescription className="text-lg">
              Join thousands of Nigerians earning passive income daily
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="px-8" asChild>
              <Link to="/plans">
                View Plans & Start Mining
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/">Back to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
