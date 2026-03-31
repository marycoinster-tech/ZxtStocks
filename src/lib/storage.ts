import { User, MiningSession, Transaction, Referral } from '@/types';

const STORAGE_KEYS = {
  USER: 'zxt_user',
  MINING_SESSION: 'zxt_mining_session',
  TRANSACTIONS: 'zxt_transactions',
  REFERRALS: 'zxt_referrals',
} as const;

export const storage = {
  // User
  getUser: (): User | null => {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
  },
  
  setUser: (user: User): void => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },
  
  clearUser: (): void => {
    localStorage.removeItem(STORAGE_KEYS.USER);
  },
  
  // Mining Session
  getMiningSession: (): MiningSession | null => {
    const data = localStorage.getItem(STORAGE_KEYS.MINING_SESSION);
    return data ? JSON.parse(data) : null;
  },
  
  setMiningSession: (session: MiningSession): void => {
    localStorage.setItem(STORAGE_KEYS.MINING_SESSION, JSON.stringify(session));
  },
  
  // Transactions
  getTransactions: (): Transaction[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  },
  
  addTransaction: (transaction: Transaction): void => {
    const transactions = storage.getTransactions();
    transactions.unshift(transaction);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  },
  
  // Referrals
  getReferrals: (): Referral[] => {
    const data = localStorage.getItem(STORAGE_KEYS.REFERRALS);
    return data ? JSON.parse(data) : [];
  },
  
  addReferral: (referral: Referral): void => {
    const referrals = storage.getReferrals();
    referrals.push(referral);
    localStorage.setItem(STORAGE_KEYS.REFERRALS, JSON.stringify(referrals));
  },
};
