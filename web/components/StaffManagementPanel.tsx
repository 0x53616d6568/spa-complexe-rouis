import { useEffect, useState, type FormEvent } from 'react';
import { Check, LoaderCircle, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useUser } from '@/lib/safe-clerk';
import { useLanguage } from '@/lib/i18n';

const permissionOptions = [
  'browse_public_services', 'create_own_booking', 'view_own_profile', 'view_own_booking_history',
  'cancel_own_booking', 'manage_own_customer_record', 'request_account_deletion', 'view_all_bookings',
  'create_edit_services', 'manage_staff_schedules', 'manage_customer_records', 'view_operational_reports',
  'view_platform_settings', 'view_business_audit_logs', 'manage_managers_admins', 'change_platform_settings', 'view_audit_logs', 'delete_disable_accounts',
  'configure_roles_permissions',
] as const;
type Permission = (typeof permissionOptions)[number];
const userPermissions: Permission[] = permissionOptions.slice(0, 7);
const managerPermissions: Permission[] = [...userPermissions, 'view_all_bookings', 'create_edit_services', 'manage_staff_schedules', 'manage_customer_records', 'view_operational_reports', 'view_platform_settings', 'view_business_audit_logs'];
const adminPermissions: Permission[] = [...userPermissions, 'view_all_bookings', 'create_edit_services', 'manage_staff_schedules', 'manage_customer_records', 'view_operational_reports', 'manage_managers_admins', 'change_platform_settings', 'view_platform_settings', 'view_business_audit_logs', 'view_audit_logs', 'delete_disable_accounts', 'configure_roles_permissions'];
const permissionsForRole = (role: string): Permission[] => role === 'admin' ? adminPermissions : role === 'manager' ? managerPermissions : userPermissions;
const permissionLabel = (permission: string) => permission.replaceAll('_', ' ');

type ManagedStaff = {
  id: string;
  displayName: string;
  bio: string;
  accountEmail: string | null;
  accountRole: string | null;
  accountPermissions: Permission[];
  accountDisabled: boolean;
  isBookable: boolean;
  isActive: boolean;
};

type StaffForm = {
  displayName: string;
  accountEmail: string;
  password: string;
  role: string;
  permissions: Permission[];
  bio: string;
  isBookable: boolean;
  isActive: boolean;
  accountDisabled: boolean;
};

const emptyForm: StaffForm = {
  displayName: '',
  accountEmail: '',
  password: '',
  role: 'user',
  permissions: userPermissions,
  bio: '',
  isBookable: true,
  isActive: true,
  accountDisabled: false,
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => null) as { error?: string } & T;
  if (!response.ok) throw new Error(body?.error || 'The staff account request failed.');
  return body;
}

export function StaffManagementPanel() {
  const { user } = useUser();
  const { t } = useLanguage();
  const canConfigurePermissions = user?.publicMetadata?.role === 'admin';
  const [items, setItems] = useState<ManagedStaff[]>([]);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changePassword, setChangePassword] = useState(false);

  const load = () => {
    setLoading(true);
    void request<ManagedStaff[]>('/api/manager/directory')
      .then(setItems)
      .catch((cause) => setError((cause as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const visible = items.filter((item) =>
    (status === 'all' || (status === 'active' ? item.isActive && !item.accountDisabled : !item.isActive || item.accountDisabled)) &&
    `${item.displayName} ${item.accountEmail || ''} ${item.accountRole || ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        ...form,
        accountEmail: form.accountEmail || undefined,
        password: form.password || undefined,
      };
      const original = editing ? items.find((item) => item.id === editing) : undefined;
      if (!canConfigurePermissions) delete payload.permissions;
      if (original && !original.accountEmail && !form.accountEmail) {
        if (form.role === (original.accountRole || 'user')) delete payload.role;
        if (JSON.stringify(form.permissions) === JSON.stringify(original.accountPermissions)) delete payload.permissions;
        delete payload.accountDisabled;
      }
      await request(editing ? `/api/manager/directory/${editing}` : '/api/manager/directory', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setEditing(null);
      setForm(emptyForm);
      setChangePassword(false);
      load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (item: ManagedStaff) => {
    setEditing(item.id);
    setChangePassword(false);
    setForm({
      displayName: item.displayName,
      accountEmail: item.accountEmail || '',
      password: '',
      role: item.accountRole || 'user',
      permissions: item.accountPermissions || permissionsForRole(item.accountRole || 'user'),
      bio: item.bio,
      isBookable: item.isBookable,
      isActive: item.isActive,
      accountDisabled: item.accountDisabled,
    });
  };

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setChangePassword(false);
    setError('');
  };

  const disable = async (item: ManagedStaff) => {
    if (!window.confirm(`Disable ${item.displayName}'s sign-in account?`)) return;
    try {
      await request(`/api/manager/directory/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false, accountDisabled: true }),
      });
      load();
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  return <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_380px]">
    <div className="rounded-[1.5rem] border border-border bg-card p-5 md:p-7">
      <div className="flex items-end justify-between"><div><p className="mono text-[9px] tracking-[.18em] text-primary">{t('STAFF ACCOUNTS')}</p><h2 className="serif mt-2 text-4xl">{t('People & access')}</h2></div><Users className="text-primary" size={24}/></div>
      <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search staff accounts")} className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm"/><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm"><option value="active">{t("Active")}</option><option value="inactive">{t("Disabled")}</option><option value="all">{t("All statuses")}</option></select></div>
      {error && <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}
      {loading ? <p className="mt-6 text-sm text-muted-foreground">{t("Loading staff accounts")}</p> : <div className="mt-6 space-y-3">{visible.map((item) => <div key={item.id} className={`rounded-2xl border p-4 ${item.isActive && !item.accountDisabled ? 'border-border' : 'border-dashed border-border opacity-60'}`}><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{item.accountEmail || t('No sign-in account')} · {item.accountRole || 'user'} · {item.isBookable ? t('Bookable') : t('Not bookable')}</p><p className="mt-1 text-[10px] uppercase tracking-[.12em] text-muted-foreground">{item.isActive && !item.accountDisabled ? t('Active') : t('Disabled')}</p></div><div className="flex gap-2"><button type="button" onClick={() => edit(item)} className="rounded-full border border-border p-2" aria-label={`Edit ${item.displayName}`}><Pencil size={14}/></button>{item.isActive && !item.accountDisabled && <button type="button" onClick={() => void disable(item)} className="rounded-full border border-border p-2 text-destructive" aria-label={`Disable ${item.displayName}`}><Trash2 size={14}/></button>}</div></div></div>)}</div>}
    </div>
    <form onSubmit={save} className="h-fit rounded-[1.5rem] border border-border bg-card p-5 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="mono text-[9px] tracking-[.18em] text-primary">{editing ? t('EDIT STAFF ACCOUNT') : t('CREATE STAFF ACCOUNT')}</p>
        {editing && <button type="button" onClick={startCreate} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-xs"><Plus size={14}/> {t('Add staff')}</button>}
      </div>
      <div className="mt-5 grid gap-3">
        <input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder={t("Display name")} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"/>
        {editing && form.accountEmail ? <p className="rounded-xl border border-border bg-background px-3 py-3 text-sm text-muted-foreground">{t('Sign-in email')}: <span className="text-foreground">{form.accountEmail}</span></p> : <input required={!editing || !form.accountEmail} type="email" value={form.accountEmail} onChange={(event) => setForm({ ...form, accountEmail: event.target.value })} placeholder={t("Account email")} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"/>}
        {editing && form.accountEmail ? <div><button type="button" onClick={() => { setChangePassword(!changePassword); setForm({ ...form, password: '' }); }} className="text-xs underline">{changePassword ? t('Cancel password change') : t('Change password')}</button>{changePassword && <input required minLength={15} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={t("New password (15+ characters)")} className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"/>}</div> : <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={t("Only needed for a new account (15+ characters)")} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"/>}
        {(!editing || !form.accountEmail) && <p className="text-xs text-muted-foreground">An existing sign-in account will be linked by email without changing its password. A new account needs a temporary password of at least 15 characters.</p>}
        <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, permissions: permissionsForRole(event.target.value) })} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"><option value="user">{t('User / Customer')}</option>{canConfigurePermissions && <><option value="manager">{t('Manager / Staff')}</option><option value="admin">{t('Admin / Owner')}</option></>}</select>
        <p className="text-xs text-muted-foreground">{form.role === 'admin' ? 'Full platform access, including manager accounts, roles, permissions, settings, and audit logs.' : form.role === 'manager' ? 'Day-to-day bookings, services, staff schedules, customers, and reports, with limited settings and business audit access. Cannot manage manager/admin accounts or change roles.' : 'Public services, own profile and customer record, own bookings, and account deletion requests.'}</p>
        {canConfigurePermissions && <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer text-sm font-medium">{t("Permissions")}</summary><p className="mt-2 text-xs text-muted-foreground">Choose what this account can access. Changing the role loads its default permissions.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{permissionOptions.map((permission) => <label key={permission} className="flex items-center gap-2 text-xs capitalize"><input type="checkbox" checked={form.permissions.includes(permission)} disabled={Boolean(editing && !items.find((item) => item.id === editing)?.accountEmail && !form.accountEmail)} onChange={(event) => setForm({ ...form, permissions: event.target.checked ? [...form.permissions, permission] : form.permissions.filter((item) => item !== permission) })} className="accent-primary"/>{t(permissionLabel(permission))}</label>)}</div></details>}
        <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="Short bio" rows={3} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"/>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.isBookable} onChange={(event) => setForm({ ...form, isBookable: event.target.checked })} className="accent-primary"/> {t("Available for bookings")}</label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.accountDisabled} onChange={(event) => setForm({ ...form, accountDisabled: event.target.checked, isActive: !event.target.checked })} className="accent-primary"/> {t("Disable sign-in account")}</label>
        <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" size={15}/> : <Check size={15}/>} {editing ? t('Save account changes') : t('Create staff account')}</button>
      </div>
    </form>
  </section>;
}
