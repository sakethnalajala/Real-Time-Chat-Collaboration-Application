let audioContext;

/** A short, soft two-tone chime generated with Web Audio (no audio files needed). */
export function playNotificationSound() {
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    [
      [880, 0],
      [1318.5, 0.09],
    ].forEach(([frequency, offset]) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.06, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.22);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.24);
    });
  } catch {
    /* audio unavailable */
  }
}

export const desktopNotificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function requestDesktopPermission() {
  if (!desktopNotificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export function showDesktopNotification({ title, body, icon, tag, onClick }) {
  if (!desktopNotificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const notification = new Notification(title, { body, icon: icon || '/favicon.svg', tag, silent: true });
    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}
