import { ModalCloseButton } from "@/components/ModalCloseButton";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastFail } from "@/lib/toast-ar";
import {
  adminListUsers,
  adminSetUserBan,
  adminSetUserPassword,
  adminSetUserRole,
} from "@/lib/admin.functions";

interface UserRow {
  id: string;
  label: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  banned: boolean;
  roles: string[];
}

const ROLES = [
  { value: "admin", label: "مسؤول" },
  { value: "moderator", label: "مشرف" },
  { value: "owner", label: "صاحب محل" },
  { value: "user", label: "مستخدم" },
] as const;

export function UsersManager() {
  const listFn = useServerFn(adminListUsers);
  const roleFn = useServerFn(adminSetUserRole);
  const banFn = useServerFn(adminSetUserBan);
  const passFn = useServerFn(adminSetUserPassword);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pwUser, setPwUser] = useState<UserRow | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const refreshUsers = useCallback(
    async (silent = false) => {
      setLoading(true);
      try {
        const result = (await listFn({ data: undefined })) as UserRow[];
        setUsers(result);
        if (!silent) {
          toast.success(`تم تحديث قائمة المستخدمين (${result.length}) ✓`);
        }
        return result;
      } catch (e) {
        if (!silent) {
          toastFail(e, "تعذّر تحميل المستخدمين");
        }
        return [] as UserRow[];
      } finally {
        setLoading(false);
      }
    },
    [listFn],
  );

  const savePassword = async () => {
    if (!pwUser) return;
    if (pw.length < 12) {
      toast.error("كلمة المرور 12 حرفًا على الأقل");
      return;
    }
    if (pw !== pw2) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy(pwUser.id);
    try {
      await passFn({ data: { userId: pwUser.id, password: pw } });
      toast.success("تم تغيير كلمة المرور ✓");
      setPwUser(null);
      setPw("");
      setPw2("");
      await refreshUsers(true);
    } catch (e) {
      toastFail(e, "تعذّر تغيير كلمة المرور");
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    void refreshUsers(true);
  }, [refreshUsers]);

  const setRole = async (u: UserRow, role: string) => {
    setBusy(u.id);
    try {
      await roleFn({ data: { userId: u.id, role: role === "none" ? null : (role as "admin") } });
      toast.success("تم تحديث الصلاحية ✓");
      await refreshUsers(true);
    } catch (e) {
      toastFail(e, "تعذّر التحديث");
    } finally {
      setBusy(null);
    }
  };

  const toggleBan = async (u: UserRow) => {
    if (!u.banned && !confirm(`حظر الحساب «${u.label}»؟`)) return;
    setBusy(u.id);
    try {
      await banFn({ data: { userId: u.id, banned: !u.banned } });
      toast.success(u.banned ? "تم رفع الحظر ✓" : "تم حظر الحساب ⛔");
      await refreshUsers(true);
    } catch (e) {
      toastFail(e, "تعذّر التنفيذ");
    } finally {
      setBusy(null);
    }
  };

  const term = q.trim();
  const visible = term
    ? users.filter((u) =>
        [u.label, u.fullName, u.email ?? "", u.phone ?? ""].join(" ").includes(term),
      )
    : users;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الجوال أو البريد..."
            className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm"
          />
          <button
            onClick={() => void refreshUsers(false)}
            className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm font-bold"
          >
            ↻
          </button>
        </div>
        <span className="text-[11px] font-bold text-muted-foreground">المجموع: {users.length}</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">جارِ التحميل...</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">لا يوجد مستخدمون.</p>
      ) : (
        <>
          <div className="hidden md:grid grid-cols-[1.2fr_1fr_1.4fr_auto] gap-3 px-3 text-[11px] font-bold text-muted-foreground">
            <span>الاسم</span>
            <span>رقم الجوال</span>
            <span>البريد المرتبط</span>
            <span>إجراءات</span>
          </div>
          <div className="grid gap-2">
            {visible.map((u) => (
              <div
                key={u.id}
                className="bg-card border border-border rounded-2xl p-3 shadow-soft grid md:grid-cols-[1.2fr_1fr_1.4fr_auto] gap-3 md:items-center"
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{u.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    انضم {u.created_at ? new Date(u.created_at).toLocaleDateString("ar") : "—"}
                    {u.banned && <span className="text-emergency font-bold"> · محظور</span>}
                  </p>
                </div>
                <p className="text-xs font-bold" dir="ltr">
                  {u.phone ?? "—"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate" dir="ltr">
                  {u.email ?? "—"}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    disabled={busy === u.id}
                    value={u.roles[0] ?? "none"}
                    onChange={(e) => setRole(u, e.target.value)}
                    className="bg-background border border-border rounded-xl px-2 py-1.5 text-xs font-bold"
                  >
                    <option value="none">بدون صلاحية</option>
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={busy === u.id}
                    onClick={() => {
                      setPwUser(u);
                      setPw("");
                      setPw2("");
                    }}
                    className="bg-secondary border border-border rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                  >
                    🔑 كلمة المرور
                  </button>
                  <button
                    disabled={busy === u.id}
                    onClick={() => toggleBan(u)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${u.banned ? "bg-primary text-primary-foreground" : "bg-emergency text-emergency-foreground"}`}
                  >
                    {u.banned ? "رفع الحظر" : "حظر"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {pwUser && (
        <div
          className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4 overflow-y-auto overscroll-contain"
          onClick={() => setPwUser(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-4 w-full max-w-sm space-y-3 max-h-[92dvh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm">تغيير كلمة مرور «{pwUser.fullName}»</h3>
              <ModalCloseButton onClose={() => setPwUser(null)} />
            </div>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="كلمة المرور الجديدة"
              dir="ltr"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="تأكيد كلمة المرور"
              dir="ltr"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={savePassword}
                disabled={busy === pwUser.id}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-bold disabled:opacity-50"
              >
                حفظ
              </button>
              <button
                onClick={() => setPwUser(null)}
                className="flex-1 bg-secondary border border-border rounded-xl py-2 text-sm font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
