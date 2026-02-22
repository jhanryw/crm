'use server';

import { signIn as logtoSignIn, signOut as logtoSignOut } from '@logto/next/server-actions';
import { logtoConfig } from '@/lib/auth/logto';

export async function signInAction() {
    await logtoSignIn(logtoConfig);
}

export async function signOutAction() {
    await logtoSignOut(logtoConfig);
}
