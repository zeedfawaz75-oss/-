import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";

export interface OpeningHours {
  open?: string; // "HH:MM"
  close?: string; // "HH:MM"
  [key: string]: string | undefined;
}

export interface Shop {
  id: string;
  owner_id: string;
  sector_id: string;
  subsection_id: string;
  name: string;
  description: string;
  phone: string;
  whatsapp: string | null;
  address: string | null;
  rating: number;
  visits: number;
  status: "pending" | "approved" | "rejected";
  specialties: string[];
  is_24_7: boolean;
  image_url: string | null;
  map_url: string | null;
  opening_hours: OpeningHours | null;
  created_at: string;
  updated_at: string;
}

/** Compute whether a shop is currently open (Yemen time, UTC+3). */
export function isShopOpenNow(shop: Pick<Shop, "is_24_7" | "opening_hours">): boolean {
  if (shop.is_24_7) return true;
  const oh = shop.opening_hours ?? {};
  const open = oh.open || "08:00";
  const close = oh.close || "22:00";
  const now = new Date();
  const yemenMinutes = ((now.getUTCHours() + 3) % 24) * 60 + now.getUTCMinutes();
  const toM = (s: string) => {
    const [h, m] = s.split(":").map((n) => parseInt(n, 10));
    return (h || 0) * 60 + (m || 0);
  };
  const o = toM(open);
  const c = toM(close);
  if (o === c) return true;
  if (o < c) return yemenMinutes >= o && yemenMinutes < c;
  // Overnight (e.g. 20:00 → 02:00)
  return yemenMinutes >= o || yemenMinutes < c;
}

const APPROVED_CACHE_KEY = "marib:shops:approved:v1";

export function readCachedApprovedShops(): Shop[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(APPROVED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Shop[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function fetchApprovedShops(): Promise<Shop[]> {
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("status", "approved")
    .order("visits", { ascending: false })
    .order("rating", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Shop[];
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(APPROVED_CACHE_KEY, JSON.stringify(rows));
    } catch {
      /* ignore */
    }
  }
  return rows;
}

export async function fetchShopById(id: string): Promise<Shop | null> {
  const { data, error } = await supabase.from("shops").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as Shop) ?? null;
}

export async function fetchShopsBySubsection(sectorId: string, subId: string): Promise<Shop[]> {
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("status", "approved")
    .eq("sector_id", sectorId)
    .eq("subsection_id", subId)
    .order("rating", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Shop[];
}

export async function fetchMyShops(userId: string): Promise<Shop[]> {
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Shop[];
}

export async function uploadShopImage(rawFile: File, ownerId: string): Promise<string> {
  // Always compress before upload so store images stay light.
  const file = await compressImage(rawFile);
  const ext =
    (file.name.split(".").pop() || "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 5) || "jpg";
  const path = `${ownerId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("shops-images").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("shops-images").getPublicUrl(path);
  return data.publicUrl;
}

export interface CreateShopInput {
  sector_id: string;
  subsection_id: string;
  name: string;
  description: string;
  phone: string;
  whatsapp?: string;
  address?: string;
  bank_name?: string;
  bank_account_holder?: string;
  bank_account_number?: string;
  specialties?: string[];
  is_24_7?: boolean;
  image_url?: string;
  map_url?: string;
  opening_hours?: OpeningHours | null;
}

export async function createShop(input: CreateShopInput, ownerId: string) {
  if (!input.image_url || !/^https?:\/\//i.test(input.image_url)) {
    throw new Error("صورة المحل إجبارية لإتمام التسجيل.");
  }
  const numbers = [input.phone, input.whatsapp].filter(Boolean) as string[];
  for (const num of numbers) {
    const clean = num.trim();
    // Only digits and an optional leading "+" are allowed: prevents any filter
    // syntax (commas, parentheses, dots) from reaching the query builder.
    if (!/^\+?\d{7,15}$/.test(clean)) {
      throw new Error(`الرقم ${num} غير صالح — يجب أن يحتوي على أرقام فقط (7 إلى 15 رقماً).`);
    }
    const [byPhone, byWhatsapp] = await Promise.all([
      supabase.from("shops").select("id").eq("phone", clean).limit(1),
      supabase.from("shops").select("id").eq("whatsapp", clean).limit(1),
    ]);
    if ((byPhone.data?.length ?? 0) > 0 || (byWhatsapp.data?.length ?? 0) > 0) {
      throw new Error(`الرقم ${clean} مسجّل مسبقاً في محل آخر — لا يمكن تكراره.`);
    }
  }
  const { data: dupName } = await supabase
    .from("shops")
    .select("id")
    .ilike("name", input.name)
    .limit(1);
  if (dupName && dupName.length > 0) {
    throw new Error("يوجد محل مسجل مسبقاً بنفس الاسم.");
  }

  const { data: created, error } = await supabase
    .from("shops")
    .insert({
      owner_id: ownerId,
      sector_id: input.sector_id,
      subsection_id: input.subsection_id,
      name: input.name,
      description: input.description,
      phone: input.phone,
      whatsapp: input.whatsapp || null,
      address: input.address || null,
      specialties: (input.specialties ?? []).map((t) => t.trim()).filter(Boolean),
      is_24_7: !!input.is_24_7,
      image_url: input.image_url?.trim() || null,
      map_url: input.map_url?.trim() || null,
      opening_hours: input.opening_hours ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      throw new Error("يوجد محل مسجل مسبقاً بنفس الاسم أو رقم الهاتف أو الواتساب.");
    }
    throw new Error(error.message);
  }

  const bank = {
    bank_name: input.bank_name?.trim() || null,
    bank_account_holder: input.bank_account_holder?.trim() || null,
    bank_account_number: input.bank_account_number?.trim() || null,
  };
  if (created?.id && (bank.bank_name || bank.bank_account_holder || bank.bank_account_number)) {
    await supabase.from("shop_bank_details").upsert({ shop_id: created.id, ...bank });
  }
}

export async function updateOwnShop(id: string, patch: Partial<CreateShopInput>) {
  const { bank_name, bank_account_holder, bank_account_number, ...shopPatch } = patch;
  const { error } = await supabase.from("shops").update(shopPatch).eq("id", id);
  if (error) throw new Error(error.message);
  if (
    bank_name !== undefined ||
    bank_account_holder !== undefined ||
    bank_account_number !== undefined
  ) {
    const { error: bankError } = await supabase.from("shop_bank_details").upsert({
      shop_id: id,
      bank_name: bank_name?.trim() || null,
      bank_account_holder: bank_account_holder?.trim() || null,
      bank_account_number: bank_account_number?.trim() || null,
    });
    if (bankError) throw new Error(bankError.message);
  }
}

export interface ShopBankDetails {
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
}

/** Bank details are protected: only the shop owner and admins can read them. */
export async function fetchShopBankDetails(shopId: string): Promise<ShopBankDetails | null> {
  const { data, error } = await supabase
    .from("shop_bank_details")
    .select("bank_name,bank_account_holder,bank_account_number")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) return null;
  return (data as ShopBankDetails) ?? null;
}

export async function deleteOwnShop(id: string) {
  const { error } = await supabase.from("shops").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
