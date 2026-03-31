export interface User {
  id: string;
  email: string;
  fullName: string;
  referralCode: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  referralCode: string;
  createdAt: string;
}

export interface MiningSession {
  id: string;
  userId: string;
  planId: string;
  startDate: string;
  endDate: string;
  hashRate: number;
  totalMined: number;
  status: 'active' | 'completed' | 'paused';
  earnedToday: number;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'payment' | 'withdrawal' | 'referral';
  amount: number;
  currency: 'NGN' | 'BTC' | 'ETH';
  status: 'pending' | 'completed' | 'failed';
  description: string;
  createdAt: string;
  reference?: string;
}

export interface MiningPlan {
  id: string;
  name: string;
  price: number;
  duration: number; // days
  hashRate: number; // TH/s
  dailyReturn: number; // NGN
  totalReturn: number; // NGN
  features: string[];
  popular?: boolean;
}

export interface Referral {
  id: string;
  referrerId: string;
  referredEmail: string;
  status: 'pending' | 'active';
  bonus: number;
  createdAt: string;
}
