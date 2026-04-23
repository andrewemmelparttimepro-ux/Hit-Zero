// src/lib/native.ts — Capacitor wrappers with web fallbacks.
// Every native call goes through here so the same code runs on web + iOS + Android.

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { db } from './supabase';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

// ── Boot: status bar, splash, deep links ─────────────────────────────────
export async function initNative() {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0B0D12' });
  } catch {}
  await SplashScreen.hide({ fadeOutDuration: 300 });

  App.addListener('appUrlOpen', ({ url }) => {
    const u = new URL(url);
    const path = (u.pathname || '') + (u.search || '');
    if (path) window.history.pushState({}, '', path);
  });
}

// ── Camera / video ───────────────────────────────────────────────────────
export async function recordVideo(): Promise<Blob | null> {
  if (!isNative) {
    // Web fallback: getUserMedia recording path lives in VideoRecorder.tsx
    return null;
  }
  const res = await Camera.getPhoto({
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    quality: 90
  });
  if (!res.webPath) return null;
  return await fetch(res.webPath).then(r => r.blob());
}

// ── Haptics ──────────────────────────────────────────────────────────────
export const haptics = {
  tap:     () => isNative && Haptics.impact({ style: ImpactStyle.Light }).catch(()=>{}),
  click:   () => isNative && Haptics.impact({ style: ImpactStyle.Medium }).catch(()=>{}),
  thunk:   () => isNative && Haptics.impact({ style: ImpactStyle.Heavy }).catch(()=>{}),
  success: () => isNative && Haptics.notification({ type: NotificationType.Success }).catch(()=>{}),
  warn:    () => isNative && Haptics.notification({ type: NotificationType.Warning }).catch(()=>{})
};

// ── Share ────────────────────────────────────────────────────────────────
export async function share(title: string, text: string, url?: string) {
  if (isNative) return Share.share({ title, text, url });
  if ((navigator as any).share) return (navigator as any).share({ title, text, url });
  await navigator.clipboard.writeText(url ?? text);
}

// ── Secure preferences (keychain on iOS) ─────────────────────────────────
export const prefs = {
  get:    (k: string) => Preferences.get({ key: k }).then(r => r.value),
  set:    (k: string, v: string) => Preferences.set({ key: k, value: v }),
  remove: (k: string) => Preferences.remove({ key: k })
};

// ── Push notifications ───────────────────────────────────────────────────
export async function registerPush(profileId: string) {
  if (!isNative) return;
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return;
  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    await db.from('push_tokens').upsert({
      profile_id: profileId,
      platform,
      token: token.value,
      device: navigator.userAgent
    }, { onConflict: 'profile_id,token' });
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const link = action.notification?.data?.link;
    if (link) window.history.pushState({}, '', link);
  });
}
