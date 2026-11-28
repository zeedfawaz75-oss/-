export function normalizePhone(rawPhone: string): string {
  let phone = rawPhone.replace(/\D/g, "");
  if (phone.startsWith("00967")) phone = phone.slice(5);
  else if (phone.startsWith("967")) phone = phone.slice(3);
  if (phone.startsWith("0")) phone = phone.slice(1);
  return phone;
}

export function isValidYemeniPhone(phone: string): boolean {
  return /^7\d{8}$/.test(normalizePhone(phone));
}

export function phoneToEmail(rawPhone: string): string {
  return `${normalizePhone(rawPhone)}@marib-dir.com`;
}

export function legacyPhoneToEmail(rawPhone: string): string {
  return `m${normalizePhone(rawPhone)}@marib.local`;
}

export function phoneFromSyntheticEmail(email: string | null | undefined): string | null {
  const match = email?.toLowerCase().match(/^m?(\d{9})@(?:marib-dir\.com|marib\.local)$/);
  return match?.[1] ?? null;
}
