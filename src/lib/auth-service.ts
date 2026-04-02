import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';
import { AuthUser } from '@/types';

export class AuthService {
  /**
   * Map Supabase user to AuthUser (synchronous - no async/await)
   */
  mapUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email!,
      fullName: user.user_metadata?.full_name || user.user_metadata?.username || user.email!.split('@')[0],
      referralCode: user.user_metadata?.referral_code || '',
      createdAt: user.created_at,
    };
  }

  /**
   * Send OTP to email for registration
   */
  async sendOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  }

  /**
   * Verify OTP, set password, and save profile (including referral data)
   */
  async verifyOtpAndSetPassword(
    email: string,
    token: string,
    password: string,
    fullName: string,
    referralCode: string,
    referredBy?: string  // the code entered by the user (someone else's code)
  ) {
    // Verify OTP
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;

    // Set password and user metadata
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
      password,
      data: {
        full_name: fullName,
        referral_code: referralCode,
      },
    });
    if (updateError) throw updateError;

    const userId = updateData.user?.id;
    if (userId) {
      // Upsert user_profile with referral_code and referred_by
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          email,
          username: fullName,
          referral_code: referralCode,
          referred_by: referredBy || null,
        }, { onConflict: 'id' });

      if (profileError) {
        console.error('Failed to save user profile with referral data:', profileError);
      }
    }

    return updateData.user;
  }

  /**
   * Sign in with email and password
   */
  async signInWithPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data.user;
  }

  /**
   * Sign out current user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Get current session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  }
}

export const authService = new AuthService();
