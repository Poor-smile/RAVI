/** Device policy for the web editor. Window width and touch alone are not devices. */
export function isMobileWebDevice(device: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: { mobile?: boolean };
}, nativeDesktop = false): boolean {
  if (nativeDesktop) return false;
  return device.userAgentData?.mobile === true ||
    /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(device.userAgent) ||
    (/Mac/i.test(device.platform ?? "") && (device.maxTouchPoints ?? 0) > 1);
}
