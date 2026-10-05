import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useClerk, useUser } from '@/lib/safe-clerk';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/lib/i18n';
import { ROUIS_SERVICES, ROUIS_CATEGORIES, formatPriceDT, formatMoneyDT, type RouisService, type RouisCategory } from '@/lib/rouis-services';
import {
  useHealthCheck,
  getHealthCheckQueryKey,
  useGetSpaProfile,
  useListServices,
  useGetService,
  useGetAvailability,
  useCreateBooking,
  useGetManagerDashboard,
  useListManagerBookings,
  useListManagerStaff,
  useUpdateBookingStatus,
  useAssignBookingStaff,
  getListManagerBookingsQueryKey,
  getGetManagerDashboardQueryKey,
} from '@workspace/api-client-react';
import type { AuditEvent, AvailabilitySlot, BookingConfirmation, ManagerBooking, Service, StaffProfile } from '@workspace/api-client-react';
import { StaffManagementPanel } from '@/components/StaffManagementPanel';
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, Clock3, Flower2, HeartHandshake,
  LoaderCircle, Menu, Moon, Pencil, Plus, RefreshCw, ShieldCheck, ShoppingBag, Sparkles, Sun, Trash2, Users, X,
} from 'lucide-react';

const BOOKING_CART_STORAGE_KEY = 'stillroom-booking-cart';
const BOOKING_CART_EVENT = 'stillroom-booking-cart-change';

function readStoredCart(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(BOOKING_CART_STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, 8) : [];
  } catch { return []; }
}

function saveStoredCart(serviceIds: string[]) {
  try {
    localStorage.setItem(BOOKING_CART_STORAGE_KEY, JSON.stringify(serviceIds.slice(0, 8)));
    window.dispatchEvent(new Event(BOOKING_CART_EVENT));
  } catch { /* Cart still works for this page if storage is unavailable. */ }
}

function Meta({ title, description }: { title: string; description: string }) {
  const { t } = useLanguage();
  useEffect(() => {
    document.title = `${t(title)} · Complexe Rouis`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t(description));
    else {
      const element = document.createElement('meta');
      element.name = 'description';
      element.content = t(description);
      document.head.appendChild(element);
    }
  }, [title, description, t]);
  return null;
}

function HealthPip() {
  const health = useHealthCheck({ query: { refetchInterval: 60000, queryKey: getHealthCheckQueryKey() } });
  return <span className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="status-live-health">
    <span className={`h-2 w-2 rounded-full ${health.isError ? 'bg-destructive' : health.data ? 'bg-emerald-700' : 'bg-amber-500'}`} />
    {health.isLoading ? 'Connecting' : health.isError ? 'Service status unavailable' : health.data?.status || 'Online'}
  </span>;
}

export function SiteShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cartCount, setCartCount] = useState(() => readStoredCart().length);
  const profile = useGetSpaProfile();
  const spa = profile.data;
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { language, setLanguage, t } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  useEffect(() => {
    const updateCartCount = () => setCartCount(readStoredCart().length);
    window.addEventListener('storage', updateCartCount);
    window.addEventListener(BOOKING_CART_EVENT, updateCartCount);
    return () => {
      window.removeEventListener('storage', updateCartCount);
      window.removeEventListener(BOOKING_CART_EVENT, updateCartCount);
    };
  }, []);
  const role = typeof user?.publicMetadata?.role === 'string' ? user.publicMetadata.role : null;
  const isStaffVisible = role === 'manager' || role === 'admin';
  const nav = [
    { href: '/', label: t('Home') }, { href: '/services', label: t('Treatments') },
    { href: '/policies', label: t('Visit information') }, ...(isStaffVisible ? [{ href: '/manager', label: t('Staff') }] : []),
  ];
  return <div className="min-h-[100dvh] bg-background text-foreground">
    <div className="border-b border-border/70 bg-secondary/65 px-4 py-2 text-center text-[11px] tracking-[.16em] text-muted-foreground">
      Ouvert 7j/7 · 09:00 – 19:00 · Complexe Rouis d'Esthétique
    </div>
    <header className="relative z-40 border-b border-border/70 bg-background/95 md:sticky md:top-0 md:backdrop-blur-md">
      <div className="mx-auto flex h-[76px] min-w-0 max-w-[1320px] items-center justify-between gap-2 px-3 sm:px-5 lg:px-10">
        <Link href="/" className="flex min-w-0 shrink items-center gap-2 sm:gap-3" data-testid="link-brand">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Flower2 size={21}/></span>
          <span className="min-w-0 max-[370px]:hidden"><span className="serif block truncate text-[20px] leading-[.9] sm:text-[22px]">Complexe Rouis</span><span className="mono mt-1 block truncate text-[8px] tracking-[.2em] text-muted-foreground">{t('A NEIGHBORHOOD PAUSE')}</span></span>
        </Link>
        <nav className="hidden items-center gap-5 lg:gap-8 md:flex">
          {nav.map(item => <Link key={item.href} href={item.href} className="text-[13px] text-foreground/75 transition hover:text-primary" data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ','-')}`}>{item.label}</Link>)}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {user ? (
            <button
              type="button"
              onClick={() => void signOut({ redirectUrl: window.location.origin + '/sign-in' })}
              className="hidden whitespace-nowrap ps-3 text-[13px] text-foreground/70 hover:text-primary sm:block"
              data-testid="button-sign-out"
            >
              {t('Sign out')}
            </button>
          ) : (
            <Link href="/sign-in" className="hidden whitespace-nowrap ps-3 text-[13px] text-foreground/70 hover:text-primary sm:block" data-testid="link-sign-in">{t('Sign in')}</Link>
          )}
          <Link href="/book" aria-label={`${t('Cart')}, ${cartCount}`} title={t('Cart')} className="relative inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-2 text-xs text-foreground/80 transition hover:border-primary hover:text-primary" data-testid="link-header-cart"><ShoppingBag size={16}/><span className="hidden sm:inline">{t('Cart')}</span><span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{cartCount}</span></Link>
          <button className="hidden rounded-full bg-primary px-5 py-3 text-xs font-semibold tracking-wide text-primary-foreground transition hover:-translate-y-0.5 md:block" onClick={() => setLocation('/book')} data-testid="button-header-book">{t('Find a time')} <ArrowRight className="ms-2 inline" size={14}/></button>
          <button className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground md:hidden" onClick={() => setLocation('/book')} data-testid="button-header-book-mobile">{t('Find a time')}<ArrowRight size={13}/></button>
          <select aria-label={t('Language')} value={language} onChange={event=>setLanguage(event.target.value as 'en'|'fr'|'ar')} className="hidden max-w-[104px] rounded-full border border-border bg-card px-2 py-2 text-xs md:block"><option value="en">English</option><option value="fr">Fran&#231;ais</option><option value="ar">&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577;</option></select>
          <button type="button" onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')} className="hidden rounded-full border border-border p-2 md:inline-flex" aria-label={t(resolvedTheme==='dark'?'Switch to light mode':'Switch to dark mode')} title={t(resolvedTheme==='dark'?'Switch to light mode':'Switch to dark mode')}>{resolvedTheme==='dark'?<Sun size={16}/>:<Moon size={16}/>}</button>
          <button className="rounded-full p-2 md:hidden" onClick={() => setOpen(!open)} aria-label={open ? t('Close menu') : t('Open menu')} data-testid="button-mobile-menu">{open ? <X size={21}/> : <Menu size={21}/>}</button>
        </div>
      </div>
      {open && <nav className="grid gap-1 border-t border-border px-5 py-3 md:hidden"><div className="flex items-center justify-between gap-3 px-3 py-2"><label htmlFor="mobile-language" className="text-sm">{t('Language')}</label><select id="mobile-language" value={language} onChange={event=>setLanguage(event.target.value as 'en'|'fr'|'ar')} className="rounded-full border border-border bg-card px-3 py-2 text-xs"><option value="en">English</option><option value="fr">Fran&#231;ais</option><option value="ar">&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577;</option></select></div><button type="button" onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')} className="flex items-center gap-2 rounded-lg px-3 py-3 text-start text-sm hover:bg-secondary">{resolvedTheme==='dark'?<Sun size={16}/>:<Moon size={16}/>} {t(resolvedTheme==='dark'?'Switch to light mode':'Switch to dark mode')}</button>{nav.map(item => <Link key={item.href} onClick={() => setOpen(false)} href={item.href} className="rounded-lg px-3 py-3 text-sm hover:bg-secondary">{item.label}</Link>)}<Link onClick={() => setOpen(false)} href="/book" className="rounded-lg border border-border px-3 py-3 text-sm">{t('Cart')} ({cartCount})</Link>{user ? <button type="button" onClick={() => void signOut({ redirectUrl: window.location.origin + '/sign-in' })} className="rounded-lg bg-secondary px-3 py-3 text-start text-sm">{t('Sign out')}</button> : <Link onClick={() => setOpen(false)} href="/sign-in" className="rounded-lg bg-secondary px-3 py-3 text-sm">{t('Sign in')}</Link>}</nav>}
    </header>
    {children}
    <footer className="bg-primary px-5 py-12 text-primary-foreground md:px-10">
      <div className="mx-auto grid max-w-[1320px] gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
        <div><div className="serif text-4xl">{t('A little room to breathe.')}</div><p className="mt-3 max-w-sm text-sm leading-6 text-primary-foreground/70">{t('A neighborhood place to set the day down for a while.')}</p><div className="mt-5"><HealthPip/></div></div>
        <div><p className="mono text-[10px] tracking-[.18em] text-primary-foreground/55">{t('FIND YOUR WAY')}</p><div className="mt-4 grid gap-3 text-sm"><Link href="/services">{t('Treatments')}</Link><Link href="/policies">{t('Visit information')}</Link><Link href="/privacy">{t('Privacy')}</Link><Link href="/admin/audit-logs">{t('Owner access')}</Link></div></div>
        <div><p className="mono text-[10px] tracking-[.18em] text-primary-foreground/55">{t('CONTACT')}</p><p className="mt-4 text-sm">{spa?.address || 'Complexe Rouis'}<br/>{spa ? `${spa.city}, ${spa.region}` : 'Tunisie'}</p><p className="mt-3 text-sm">{spa?.contactEmail || 'contact@complexerouis.com'}</p><p className="mt-1 text-sm">{spa?.contactPhone || '+216 -- --- ---'}</p></div>
      </div>
      <div className="mx-auto mt-10 max-w-[1320px] border-t border-primary-foreground/20 pt-5 text-[10px] text-primary-foreground/55">© Complexe Rouis d'esthétique — Tous droits réservés.</div>
    </footer>
  </div>;
}

function LoadingBlock({ label = 'Gathering the details' }: { label?: string }) {
  const { t } = useLanguage();
  return <div className="grid min-h-[240px] place-items-center"><div className="text-center"><div className="mx-auto h-10 w-40 animate-pulse rounded-full bg-secondary"/><p className="mt-4 text-sm text-muted-foreground">{t(label)}</p></div></div>;
}
function ErrorBlock({ retry }: { retry: () => void }) {
  const { t } = useLanguage();
  return <div className="mx-auto my-12 max-w-lg rounded-2xl border border-border bg-card p-8 text-center"><p className="serif text-3xl">{t("We couldn't reach the schedule.")}</p><p className="mt-2 text-sm text-muted-foreground">{t('Please try again in a moment.')}</p><button onClick={retry} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground" data-testid="button-retry"><RefreshCw size={15}/> {t('Try again')}</button></div>;
}

function DynamicServiceCard({ service }: { service: Service }) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  return (
    <div className="group flex flex-col justify-between overflow-hidden rounded-[1.4rem] border border-border/70 bg-card transition duration-300 hover:-translate-y-1 hover:shadow-lg" data-testid={`card-service-${service.id}`}>
      <Link href={`/services/${service.slug || service.id}`} className="block">
        <div className="relative h-48 overflow-hidden bg-secondary">
          {service.imageUrl ? (
            <img src={service.imageUrl} alt={service.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <div className="absolute left-[15%] top-[22%] h-28 w-28 rounded-full border border-primary/15" />
              <div className="absolute bottom-0 right-[12%] h-36 w-36 rounded-full bg-primary/10" />
              <Flower2 className="relative text-primary/45" size={74} strokeWidth={0.8} />
            </div>
          )}
          <span className="absolute start-4 top-4 rounded-full bg-background/85 px-3 py-1.5 text-[10px] tracking-[.12em] backdrop-blur">
            {service.category}
          </span>
          {service.isFeatured && (
            <span className="absolute end-4 top-4 rounded-full bg-primary px-3 py-1.5 text-[10px] tracking-[.1em] text-primary-foreground">
              {t('FEATURED')}
            </span>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="serif text-[22px] leading-tight group-hover:text-primary transition">{service.name}</h3>
            <ArrowUpRight size={18} className="mt-1 shrink-0 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
          {service.shortDescription && (
            <p className="mt-2 text-xs leading-5 text-muted-foreground line-clamp-2">
              {service.shortDescription}
            </p>
          )}
        </div>
      </Link>
      <div className="px-5 pb-5 pt-0">
        <div className="flex items-center justify-between border-t border-border/70 pt-4 text-xs">
          <div className="flex flex-col">
            <span className="flex flex-col items-end"><span className="font-semibold text-primary text-sm">{formatMoney(service.priceAmount, service.currency)}</span>{service.discountPercent>0&&<span className="text-[10px]"><del className="me-1 text-muted-foreground">{formatMoney(service.originalPriceAmount,service.currency)}</del><span className="font-semibold text-destructive">-{service.discountPercent}%</span></span>}</span>
            <span className="text-[10px] text-muted-foreground">{service.durationMinutes} min</span>
          </div>
          <button
            type="button"
            onClick={() => setLocation(`/book?service=${service.id}`)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 hover:bg-primary px-3.5 py-1.5 text-xs font-medium text-primary hover:text-primary-foreground transition"
          >
            {t('Book')} <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatMoney(amount: number, currency: string) {
  return formatMoneyDT(amount, currency);
}

const CUSTOMER_PROFILE_KEY = 'stillroom-customer-profile';
const BOOKING_HISTORY_KEY = 'stillroom-booking-history';

type HistoryEntry = {
  id: string;
  bookingReference: string;
  serviceName: string;
  startsAt: string;
  status: string;
  priceAmount: number;
  currency: string;
};

function readStoredCustomerProfile() {
  try {
    const raw = window.localStorage.getItem(CUSTOMER_PROFILE_KEY);
    if (!raw) return { name: '', email: '', phone: '' };
    const parsed = JSON.parse(raw) as { name?: string; email?: string; phone?: string };
    return { name: parsed.name ?? '', email: parsed.email ?? '', phone: parsed.phone ?? '' };
  } catch {
    return { name: '', email: '', phone: '' };
  }
}

function saveStoredCustomerProfile(profile: { name: string; email: string; phone: string }) {
  try {
    window.localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage errors; the booking form still works without persisted profile data.
  }
}

function readStoredBookingHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(BOOKING_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredBookingHistory(history: HistoryEntry[]) {
  try {
    window.localStorage.setItem(BOOKING_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  } catch {
    // Ignore storage errors; history is a convenience feature, not a critical requirement.
  }
}

function IntroTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  const { t } = useLanguage();
  return <div className="max-w-3xl"><p className="mono text-[10px] tracking-[.2em] text-primary">{t(eyebrow)}</p><h1 className="serif mt-4 text-5xl leading-[.98] md:text-7xl">{t(title)}</h1><p className="mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground">{t(text)}</p></div>;
}

export function HomePage() {
  const { t } = useLanguage();
  const profile = useGetSpaProfile();
  const services = useListServices();
  const refresh = () => { void profile.refetch(); void services.refetch(); };
  return <><Meta title="A neighborhood pause" description="Explore thoughtful spa treatments and find a time that works for you."/><main className="page-enter">
    <section className="relative mx-auto max-w-[1440px] overflow-hidden px-5 py-12 md:px-10 md:py-16">
      <div className="grid min-h-[560px] items-center gap-8 lg:grid-cols-[.88fr_1.12fr]">
        <div className="relative z-10 py-5 lg:ps-8"><p className="mono text-[10px] tracking-[.22em] text-primary">{t('YOUR NEIGHBORHOOD RESET')}</p><h1 className="serif mt-7 max-w-[560px] text-[62px] leading-[.93] md:text-[86px]">{t('Make a little')}<br/>{t('room for')} <em>{t('you.')}</em></h1><p className="mt-7 max-w-[420px] text-[15px] leading-7 text-muted-foreground">{t('A considered pause in the middle of everything. Choose a treatment, find a time, and let the outside world wait a moment.')}</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/book" className="rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition hover:-translate-y-0.5" data-testid="link-hero-book">{t('Book your visit')} <ArrowRight className="ms-3 inline" size={15}/></Link><Link href="/services" className="rounded-full border border-border px-6 py-4 text-sm transition hover:bg-secondary" data-testid="link-explore-services">{t('Explore treatments')}</Link></div><div className="mt-12 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px w-10 bg-accent-foreground/30"/>{profile.data?.tagline || t('A calm place, close to home')}</div></div>
        <div className="relative min-h-[360px] md:min-h-[540px]">
          <div className="absolute inset-0 overflow-hidden rounded-[42%_42%_2rem_2rem] bg-secondary">
            <img className="h-full w-full object-cover" src="/spa-courtyard.png" alt="A quiet, sunlit spa courtyard with leafy shadows and natural stone"/>
            <div className="absolute inset-0 bg-gradient-to-t from-primary/25 via-transparent to-transparent"/>
          </div>
          <div className="absolute -bottom-3 start-0 max-w-[225px] rounded-2xl bg-card p-4 shadow-lg md:bottom-8 md:-start-8"><p className="mono text-[9px] tracking-[.16em] text-primary">{t('THE STILLROOM WAY')}</p><p className="serif mt-2 text-[21px] leading-6">{t('A slower hour can change the shape of a day.')}</p></div>
          <div className="absolute right-4 top-8 grid h-20 w-20 place-items-center rounded-full border border-background/70 bg-background/80 text-center backdrop-blur"><span className="mono text-[9px] leading-4 tracking-[.13em]">{t('PAUSE')}<br/>{t('HERE')}</span></div>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-[1320px] px-5 py-20 md:px-10 md:py-28">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="mono text-[10px] tracking-[.2em] text-primary">{t('A GOOD PLACE TO BEGIN')}</p><h2 className="serif mt-3 text-5xl md:text-6xl">{t('Time that feels like yours.')}</h2></div><Link href="/services" className="text-sm underline decoration-border underline-offset-4 hover:decoration-primary">{t('See every treatment')} <ArrowRight className="ms-2 inline" size={14}/></Link></div>
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {services.isLoading ? (
          <LoadingBlock label="Loading treatments" />
        ) : (
          (Array.isArray(services.data) ? services.data.filter(s => s.isFeatured).slice(0, 6) : []).map(s => (
            <DynamicServiceCard key={s.id} service={s} />
          ))
        )}
      </div>
    </section>
    <section className="bg-secondary px-5 py-20 md:px-10 md:py-28"><div className="mx-auto grid max-w-[1320px] items-center gap-10 md:grid-cols-[.8fr_1.2fr]"><div className="rounded-[2rem] bg-card p-8 md:min-h-[360px] md:p-12"><div className="flex h-full min-h-[260px] flex-col justify-between rounded-[1.5rem] border border-primary/15 p-6"><Sparkles size={28} className="text-primary"/><p className="serif max-w-md text-4xl leading-[1.05]">Thoughtfully simple, from hello to see-you-soon.</p><p className="mono text-[9px] tracking-[.17em] text-primary">THE VISIT, AT YOUR PACE</p></div></div><div className="md:ps-10"><p className="mono text-[10px] tracking-[.2em] text-primary">YOUR TIME, YOUR WAY</p><h2 className="serif mt-4 max-w-xl text-5xl leading-[.98] md:text-6xl">A softer rhythm starts before you arrive.</h2><p className="mt-6 max-w-lg text-sm leading-7 text-muted-foreground">Browse what feels right, book without creating an account, and arrive knowing what to expect. Simple, clear, and made around your day.</p><div className="mt-8 grid gap-5 sm:grid-cols-2"><div className="flex gap-3"><CalendarDays className="mt-1 shrink-0 text-primary" size={20}/><div><p className="font-medium">Find a time online</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Availability updates from our live schedule.</p></div></div><div className="flex gap-3"><HeartHandshake className="mt-1 shrink-0 text-primary" size={20}/><div><p className="font-medium">A warm welcome</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Share a note for the team when you book.</p></div></div></div><Link href="/book" className="mt-8 inline-flex items-center rounded-full bg-primary px-6 py-4 text-sm text-primary-foreground">Plan a visit <ArrowRight className="ms-3" size={15}/></Link></div></div></section>
    <section className="mx-auto max-w-[1320px] px-5 py-20 md:px-10 md:py-24"><div className="rounded-[2rem] border border-border bg-card px-6 py-10 md:flex md:items-center md:justify-between md:px-12 md:py-12"><div><p className="mono text-[10px] tracking-[.18em] text-primary">GOOD TO KNOW</p><h2 className="serif mt-3 text-4xl">A few details, before you book.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Hours, contact details, and cancellation terms are currently setup placeholders. Review the visit information before confirming an appointment.</p></div><Link href="/policies" className="mt-7 inline-flex shrink-0 items-center gap-2 border-b border-primary pb-2 text-sm md:mt-0">Read visit information <ArrowRight size={14}/></Link></div></section>
  </main></>;
}

export function ServicesPage() {
  const { t } = useLanguage();
  const services = useListServices();
  const [filter, setFilter] = useState<string>('Tout');

  const allCategories = useMemo(() => {
    const list = Array.isArray(services.data) ? services.data.map(s => s.category).filter(Boolean) : [];
    return ['Tout', ...Array.from(new Set(list))];
  }, [services.data]);

  const items = useMemo(() => {
    if (!Array.isArray(services.data)) return [];
    if (filter === 'Tout') return services.data;
    return services.data.filter(s => s.category === filter);
  }, [services.data, filter]);

  return (
    <>
      <Meta title={t('Treatments')} description={t('Browse the current treatment menu and appointment details.')} />
      <main className="page-enter mx-auto max-w-[1320px] px-5 py-14 md:px-10 md:py-20">
        <IntroTitle
          eyebrow={t('THE TREATMENT MENU')}
          title={t('Find your kind of pause.')}
          text={t('Each visit has its own pace. Explore the current menu, and choose the time that works for you.')}
        />
        <div className="mt-10 flex gap-2 overflow-x-auto pb-2 scrollbar-hide" role="tablist" aria-label={t('Treatments')}>
          {allCategories.map(c => (
            <button
              key={c}
              role="tab"
              aria-selected={filter === c}
              onClick={() => setFilter(c)}
              className={`shrink-0 rounded-full px-4 py-2.5 text-xs transition ${
                filter === c ? 'bg-primary text-primary-foreground' : 'border border-border bg-card hover:bg-secondary'
              }`}
              data-testid={`filter-${c.toLowerCase().replaceAll(' ', '-').replaceAll('&', '-')}`}
            >
              {c === 'Tout' ? t('All') : t(c)}
            </button>
          ))}
        </div>
        {services.isLoading ? (
          <LoadingBlock label="Loading treatments" />
        ) : services.isError ? (
          <ErrorBlock retry={() => void services.refetch()} />
        ) : items.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(s => (
              <DynamicServiceCard key={s.id} service={s} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-dashed border-border p-12 text-center">
            <Flower2 className="mx-auto text-primary" size={30} />
            <p className="serif mt-3 text-3xl">{t('The menu is taking shape.')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('No treatments are available for this selection right now.')}</p>
          </div>
        )}
      </main>
    </>
  );
}

export function ServiceDetailPage({ slug }: { slug: string }) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const result = useGetService(slug);
  const s = result.data;

  return (
    <>
      <Meta title={s?.name || 'Treatment details'} description={s?.shortDescription || 'Treatment information and booking details.'} />
      <main className="page-enter mx-auto max-w-[1320px] px-5 py-8 md:px-10 md:py-12">
        <Link href="/services" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeft size={16} /> {t('All treatments')}
        </Link>
        {result.isLoading ? (
          <LoadingBlock />
        ) : result.isError || !s ? (
          <ErrorBlock retry={() => void result.refetch()} />
        ) : (
          <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_.9fr]">
            <div className="relative min-h-[370px] overflow-hidden rounded-[2rem] bg-secondary md:min-h-[590px]">
              {s.imageUrl ? (
                <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full min-h-[370px] place-items-center">
                  <Flower2 size={100} className="text-primary/40" strokeWidth={0.8} />
                </div>
              )}
              <span className="absolute start-5 top-5 rounded-full bg-background/85 px-4 py-2 text-xs">{s.category}</span>
            </div>
            <div className="flex flex-col justify-center py-3 lg:ps-8">
              <p className="mono text-[10px] tracking-[.2em] text-primary">{t('A MOMENT FOR YOU')}</p>
              <h1 className="serif mt-4 text-5xl leading-[.95] md:text-7xl">{s.name}</h1>
              <p className="mt-5 text-lg leading-7 text-muted-foreground">{s.shortDescription}</p>
              <p className="mt-6 whitespace-pre-line text-sm leading-7">{s.description}</p>
              <div className="mt-8 grid grid-cols-2 border-y border-border py-5">
                <div>
                  <p className="mono text-[9px] tracking-[.16em] text-muted-foreground">{t('DURATION')}</p>
                  <p className="mt-2 flex items-center gap-2 text-sm">
                    <Clock3 size={16} />
                    {s.durationMinutes} {t('minutes')}
                  </p>
                </div>
                <div>
                  <p className="mono text-[9px] tracking-[.16em] text-muted-foreground">{t('PRICE')}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-primary">{formatMoney(s.priceAmount, s.currency)}{s.discountPercent>0&&<><del className="text-xs font-normal text-muted-foreground">{formatMoney(s.originalPriceAmount,s.currency)}</del><span className="rounded-full bg-destructive/10 px-2 py-1 text-[10px] text-destructive">-{s.discountPercent}%</span></>}</p>
                </div>
              </div>
              <button
                onClick={() => setLocation(`/book?service=${s.id}`)}
                className="mt-8 flex w-full items-center justify-between rounded-full bg-primary px-6 py-4 text-start text-sm text-primary-foreground hover:opacity-95 transition"
              >
                {t('Find a time for this treatment')} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function dateLocal(d: Date) { const local = new Date(d.getTime()-d.getTimezoneOffset()*60000); return local.toISOString().slice(0,10); }
function makeIdempotencyKey() { return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export function BookingPage() {
  const { user } = useUser();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const services = useListServices();
  const profile = useGetSpaProfile();
  const params = new URLSearchParams(window.location.search);
  const initialServiceId = params.get('service') || '';
  const [serviceToAdd, setServiceToAdd] = useState('');
  const [cartServiceIds, setCartServiceIds] = useState<string[]>(() => {
    const storedCart = readStoredCart();
    return initialServiceId
      ? [initialServiceId, ...storedCart.filter(id => id !== initialServiceId)].slice(0, 8)
      : storedCart;
  });
  const [date, setDate] = useState(dateLocal(new Date()));
  const [slot, setSlot] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const idempotency = useRef<{ signature: string; key: string } | null>(null);
  const cartQuery = useQuery<AvailabilitySlot[]>({
    queryKey: ['/api/availability/cart', { serviceIds: cartServiceIds, date }],
    enabled: cartServiceIds.length > 0 && !!date,
    queryFn: async () => {
      const search = new URLSearchParams({ serviceIds: cartServiceIds.join(','), date });
      const response = await fetch(`/api/availability/cart?${search.toString()}`);
      const payload = await response.json().catch(() => null) as AvailabilitySlot[] | { error?: string } | null;
      if (!response.ok) throw new Error(payload && !Array.isArray(payload) ? payload.error || 'Availability could not be loaded.' : 'Availability could not be loaded.');
      return (payload || []) as AvailabilitySlot[];
    },
  });
  const cartServices = cartServiceIds.map(id => services.data?.find(item => item.id === id)).filter((item): item is Service => Boolean(item));
  const totalServiceDuration = cartServices.reduce((sum, item) => sum + item.durationMinutes, 0);
  const totalPrice = cartServices.reduce((sum, item) => sum + item.priceAmount, 0);
  const currency = cartServices[0]?.currency || 'NGN';

  useEffect(() => { saveStoredCart(cartServiceIds); }, [cartServiceIds]);

  useEffect(() => {
    const savedProfile = readStoredCustomerProfile();
    const clerkName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim() : '';
    const clerkEmail = user?.primaryEmailAddress?.emailAddress ?? savedProfile.email;
    const clerkPhone = user?.phoneNumbers?.[0]?.phoneNumber ?? savedProfile.phone;
    const nextName = clerkName || savedProfile.name;
    const nextEmail = clerkEmail || savedProfile.email;
    const nextPhone = clerkPhone || savedProfile.phone;
    if (nextName && !name) setName(nextName);
    if (nextEmail && !email) setEmail(nextEmail);
    if (nextPhone && !phone) setPhone(nextPhone);
    saveStoredCustomerProfile({ name: nextName || name, email: nextEmail || email, phone: nextPhone || phone });
  }, [user, name, email, phone]);

  useEffect(() => { saveStoredCustomerProfile({ name, email, phone }); }, [name, email, phone]);

  const addToCart = () => {
    setFormError('');
    if (!serviceToAdd) { setFormError(t('Choose a treatment to continue.')); return; }
    if (cartServiceIds.includes(serviceToAdd)) { setFormError(t('That treatment is already in your cart.')); return; }
    if (cartServiceIds.length >= 8) { setFormError(t('Your cart can contain up to eight treatments.')); return; }
    setCartServiceIds(current => [...current, serviceToAdd]);
    setServiceToAdd('');
    setSlot('');
  };
  const removeFromCart = (serviceId: string) => {
    setCartServiceIds(current => current.filter(id => id !== serviceId));
    setSlot('');
    setFormError('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!cartServices.length) { setFormError(t('Add at least one treatment to your cart.')); return; }
    if (!slot) { setFormError(t('Choose an available appointment time.')); return; }
    if (name.trim().length < 2) { setFormError(t('Enter your name so the team knows who to welcome.')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFormError(t('Enter a valid email address.')); return; }
    if (phone.replace(/\D/g, '').length < 7) { setFormError(t('Enter a phone number with at least 7 digits.')); return; }
    if (!accepted) { setFormError(t('Please accept the visit policy to continue.')); return; }
    const signature = JSON.stringify([cartServiceIds, slot, name.trim(), email.trim(), phone.trim(), note.trim()]);
    if (idempotency.current?.signature !== signature) idempotency.current = { signature, key: makeIdempotencyKey() };
    setSubmitting(true);
    try {
      const response = await fetch('/api/bookings/cart', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceIds: cartServiceIds, startsAt: slot, customerName: name.trim(), customerEmail: email.trim(), customerPhone: phone.trim(), customerNote: note.trim() || undefined, policyAccepted: true, idempotencyKey: idempotency.current.key }),
      });
      const payload = await response.json().catch(() => null) as BookingConfirmation | { error?: string } | null;
      if (!response.ok || !payload || 'error' in payload) {
        const message = payload && 'error' in payload ? payload.error : undefined;
        throw Object.assign(new Error(message || t('Your booking could not be completed. Please try again.')), { status: response.status });
      }
      const confirmation = payload as BookingConfirmation;
      const history = readStoredBookingHistory();
      const nextHistory: HistoryEntry[] = [{
        id: confirmation.bookingReference, bookingReference: confirmation.bookingReference,
        serviceName: confirmation.serviceName, startsAt: confirmation.startsAt, status: confirmation.status,
        priceAmount: confirmation.priceAmount, currency: confirmation.currency,
      }, ...history.filter(entry => entry.bookingReference !== confirmation.bookingReference)];
      saveStoredBookingHistory(nextHistory);
      saveStoredCustomerProfile({ name: name.trim(), email: email.trim(), phone: phone.trim() });
      saveStoredCart([]);
      sessionStorage.setItem('stillroom-confirmation', JSON.stringify(confirmation));
      void queryClient.invalidateQueries({ queryKey: getListManagerBookingsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetManagerDashboardQueryKey() });
      setLocation('/booking/confirmed');
    } catch (error) {
      const bookingError = error as { status?: number; message?: string };
      setFormError(bookingError.status === 409 ? t('Choose another available appointment time.') : bookingError.message || t('Your booking could not be completed. Please try again.'));
      void cartQuery.refetch();
    } finally { setSubmitting(false); }
  };

  return <><Meta title="Book a visit" description="Choose treatments and a real available appointment time."/><main className="page-enter mx-auto max-w-[1180px] px-5 py-12 md:px-10 md:py-16">
    <div className="mb-10"><p className="mono text-[10px] tracking-[.2em] text-primary">{t('BOOK WITHOUT AN ACCOUNT')}</p><h1 className="serif mt-3 text-5xl md:text-6xl">{t('Make it your time.')}</h1><p className="mt-3 text-sm text-muted-foreground">{t('Choose treatments, add them to your cart, and reserve them together.')}</p></div>
    <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
      <form onSubmit={submit} className="space-y-8 rounded-[1.5rem] border border-border bg-card p-5 md:p-8">
        <section><StepLabel n="01" text="Choose a treatment"/><div className="mt-4 flex flex-col gap-3 sm:flex-row"><select value={serviceToAdd} onChange={event => setServiceToAdd(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-input bg-background px-4 py-3.5 text-sm" data-testid="select-booking-service"><option value="">{t('Select a treatment')}</option>{services.data?.map(service => <option value={service.id} key={service.id}>{service.name} | {service.durationMinutes} min | {formatMoney(service.priceAmount, service.currency)}</option>)}</select><button type="button" onClick={addToCart} disabled={!serviceToAdd || cartServiceIds.length >= 8} className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm disabled:opacity-50"><Plus size={15}/>{t('Add to cart')}</button></div>{services.isLoading&&<p className="mt-2 text-xs text-muted-foreground">{t('Loading treatments')}</p>}{services.isError&&<button type="button" onClick={()=>void services.refetch()} className="mt-2 text-xs underline">{t('Retry loading treatments')}</button>}
          <div className="mt-5 rounded-2xl border border-border p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-medium">{t('Your cart')}</h3><span className="text-xs text-muted-foreground">{cartServices.length}/8</span></div>{cartServices.length?<ul className="mt-3 divide-y divide-border">{cartServices.map((service,index)=><li key={service.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm">{index+1}. {service.name}</p><p className="mt-1 text-xs text-muted-foreground">{service.durationMinutes} min | {service.discountPercent>0&&<><del className="me-1">{formatMoney(service.originalPriceAmount,service.currency)}</del><span className="me-1 text-destructive">-{service.discountPercent}%</span></>}{formatMoney(service.priceAmount,service.currency)}</p></div><button type="button" onClick={()=>removeFromCart(service.id)} aria-label={`${t('Remove')} ${service.name}`} className="rounded-full border border-border px-3 py-1.5 text-xs">{t('Remove')}</button></li>)}</ul>:<p className="mt-3 text-sm text-muted-foreground">{t('Your cart is empty. Add one or more treatments to continue.')}</p>}</div>
        </section>
        <section><StepLabel n="02" text="Pick a day & time"/><input type="date" min={dateLocal(new Date())} value={date} onChange={event=>{setDate(event.target.value);setSlot('')}} className="mt-4 rounded-xl border border-input bg-background px-4 py-3 text-sm" data-testid="input-booking-date"/>{cartServiceIds.length>0&&<div className="mt-4">{cartQuery.isLoading?<div className="flex gap-2">{[1,2,3,4].map(i=><span key={i} className="h-10 w-20 animate-pulse rounded-full bg-secondary"/>)}</div>:cartQuery.isError?<div className="rounded-xl bg-secondary p-4 text-sm">{t('Availability could not be loaded.')} <button type="button" onClick={()=>void cartQuery.refetch()} className="underline">{t('Try again')}</button></div>:cartQuery.data?.length?<div className="flex flex-wrap gap-2">{cartQuery.data.map(item=><button type="button" key={item.startsAt} onClick={()=>setSlot(item.startsAt)} className={`rounded-full border px-4 py-2.5 text-xs transition ${slot===item.startsAt?'border-primary bg-primary text-primary-foreground':'border-border hover:bg-secondary'}`} data-testid={`slot-${item.startsAt}`}>{item.label}</button>)}</div>:<div className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">{t('No available times for this cart on this date. Choose another day.')}</div>}</div>}</section>
        <section><StepLabel n="03" text="Your details"/><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-xs">{t('Full name')}<input required minLength={2} maxLength={120} value={name} onChange={event=>setName(event.target.value)} autoComplete="name" className="rounded-xl border border-input bg-background px-4 py-3 text-sm" data-testid="input-booking-name"/></label><label className="grid gap-2 text-xs">{t('Email address')}<input required type="email" maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" className="rounded-xl border border-input bg-background px-4 py-3 text-sm" data-testid="input-booking-email"/></label><label className="grid gap-2 text-xs">{t('Phone number')}<input required type="tel" minLength={7} maxLength={40} value={phone} onChange={event=>setPhone(event.target.value)} autoComplete="tel" className="rounded-xl border border-input bg-background px-4 py-3 text-sm" data-testid="input-booking-phone"/></label><label className="grid gap-2 text-xs">{t('A note for our team')} <span className="text-muted-foreground">{t('(optional)')}</span><input maxLength={1000} value={note} onChange={event=>setNote(event.target.value)} className="rounded-xl border border-input bg-background px-4 py-3 text-sm" data-testid="input-booking-note"/></label></div></section>
        <section className="rounded-xl bg-secondary/70 p-4"><label className="flex cursor-pointer items-start gap-3 text-xs leading-5"><input type="checkbox" checked={accepted} onChange={event=>setAccepted(event.target.checked)} className="mt-1 accent-primary" data-testid="checkbox-policy-accept"/><span>{t('I have read and accept the')} <Link className="underline" href="/policies">{t('visit and cancellation policy')}</Link>. {t('Current policy details are demo/setup placeholders.')}</span></label></section>
        {formError&&<p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert" data-testid="status-booking-error">{formError}</p>}
        <button disabled={submitting||cartServices.length===0} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground disabled:opacity-60" data-testid="button-submit-booking">{submitting?<><LoaderCircle className="animate-spin" size={17}/>{t('Checking and booking?')}</>:<>{t('Reserve cart')} <ArrowRight size={16}/></>}</button>
      </form>
      <aside className="h-fit rounded-[1.5rem] bg-secondary p-6 lg:sticky lg:top-28"><p className="mono text-[9px] tracking-[.2em] text-primary">{t('YOUR VISIT')}</p><h2 className="serif mt-3 text-3xl">{t('Reservation summary')}</h2>{cartServices.length?<div className="mt-5 border-t border-primary/15 pt-4 text-sm"><ul className="space-y-3">{cartServices.map(service=><li key={service.id} className="flex justify-between gap-3"><span>{service.name}</span><span className="whitespace-nowrap">{service.discountPercent>0&&<><del className="me-1 text-muted-foreground">{formatMoney(service.originalPriceAmount,service.currency)}</del><span className="me-1 text-destructive">-{service.discountPercent}%</span></>}{formatMoney(service.priceAmount,service.currency)}</span></li>)}</ul><div className="mt-4 flex justify-between border-t border-primary/15 pt-4"><span className="text-muted-foreground">{t('Treatment time')}</span><span>{totalServiceDuration} min</span></div><div className="flex justify-between py-2 font-medium"><span>{t('Total')}</span><span>{formatMoney(totalPrice,currency)}</span></div><div className="flex justify-between py-2"><span className="text-muted-foreground">{t('Date')}</span><span>{date?new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'}):t('Choose a date')}</span></div><div className="flex justify-between py-2"><span className="text-muted-foreground">{t('Time')}</span><span>{cartQuery.data?.find(item=>item.startsAt===slot)?.label||t('Choose a time')}</span></div></div>:<p className="mt-2 text-sm leading-6 text-muted-foreground">{t('Your cart is empty. Add one or more treatments to continue.')}</p>}{cartServices.length > 1 && <p className="mt-2 text-xs text-muted-foreground">{t('Includes the required space between treatments.')}</p>}<div className="mt-6 border-t border-primary/15 pt-4"><div className="flex gap-3"><ShieldCheck className="shrink-0 text-primary" size={18}/><p className="text-xs leading-5 text-muted-foreground">{t('No account needed. Your request is checked against live availability when you confirm.')}</p></div><p className="mt-4 text-[10px] leading-4 text-muted-foreground">{profile.data?.cancellationPolicy||t('Cancellation policy is a demo/setup placeholder.')}</p></div></aside>
    </div></main></>;
}

export function AccountPage() {
  const { user } = useUser();
  const { t } = useLanguage();
  const [tab, setTab] = useState<'profile' | 'history'>('profile');
  useEffect(() => {
    if (!user) return;
    void fetch('/api/auth/link-customer', { method: 'POST', credentials: 'include' }).catch(() => undefined);
  }, [user?.id]);
  const profile = readStoredCustomerProfile();
  const bookings = readStoredBookingHistory();
  const upcoming = bookings.filter(item => new Date(item.startsAt).getTime() >= Date.now()).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const previous = bookings.filter(item => new Date(item.startsAt).getTime() < Date.now()).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return <><Meta title="Your account" description="Your saved spa details and booking history."/><main className="page-enter mx-auto max-w-[1200px] px-5 py-12 md:px-10 md:py-16"><div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="mono text-[10px] tracking-[.2em] text-primary">YOUR ACCOUNT</p><h1 className="serif mt-3 text-5xl md:text-6xl">{t('Welcome back')}{user?.firstName ? `, ${user.firstName}` : ''}.</h1></div><div className="flex gap-2 rounded-full border border-border bg-card p-1"><button type="button" onClick={() => setTab('profile')} className={`rounded-full px-4 py-2 text-xs ${tab === 'profile' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{t('Profile')}</button><button type="button" onClick={() => setTab('history')} className={`rounded-full px-4 py-2 text-xs ${tab === 'history' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{t('History')}</button></div></div>{tab === 'profile' ? <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]"><section className="rounded-[1.5rem] border border-border bg-card p-6"><h2 className="serif text-3xl">{t('Saved details')}</h2><div className="mt-5 space-y-4 text-sm"><div><p className="text-muted-foreground">Name</p><p className="mt-1 font-medium">{profile.name || user?.fullName || 'Not saved yet'}</p></div><div><p className="text-muted-foreground">Email</p><p className="mt-1 font-medium">{profile.email || user?.primaryEmailAddress?.emailAddress || 'Not saved yet'}</p></div><div><p className="text-muted-foreground">Phone</p><p className="mt-1 font-medium">{profile.phone || user?.phoneNumbers?.[0]?.phoneNumber || 'Not saved yet'}</p></div></div></section><section className="rounded-[1.5rem] border border-border bg-card p-6"><h2 className="serif text-3xl">{t('Quick actions')}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><Link href="/book" className="rounded-2xl bg-secondary px-4 py-5 text-start hover:bg-secondary/80"><p className="mono text-[9px] tracking-[.16em] text-primary">BOOK</p><p className="serif mt-2 text-2xl">{t('New visit')}</p></Link><Link href="/services" className="rounded-2xl bg-secondary px-4 py-5 text-start hover:bg-secondary/80"><p className="mono text-[9px] tracking-[.16em] text-primary">EXPLORE</p><p className="serif mt-2 text-2xl">{t('Treatments')}</p></Link></div><p className="mt-6 text-sm leading-6 text-muted-foreground">Your contact details are remembered automatically after you book, and they will be reused the next time you choose a treatment.</p></section></div> : <section className="rounded-[1.5rem] border border-border bg-card p-6"><h2 className="serif text-3xl">{t('Booking history')}</h2>{bookings.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t('No bookings yet. Your upcoming and past appointments will appear here once you book a visit.')}</div> : <div className="mt-6 grid gap-4"><div><h3 className="mono text-[9px] tracking-[.2em] text-primary">UPCOMING</h3>{upcoming.length ? <div className="mt-3 space-y-3">{upcoming.map(item => <div key={item.id} className="rounded-2xl border border-border bg-secondary/40 p-4"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="font-medium">{item.serviceName}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.startsAt).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-[.12em] text-primary">{item.status}</span><span className="text-sm font-medium">{formatMoney(item.priceAmount, item.currency)}</span></div></div></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No upcoming appointments.</p>}</div><div className="mt-6"><h3 className="mono text-[9px] tracking-[.2em] text-primary">PAST</h3>{previous.length ? <div className="mt-3 space-y-3">{previous.map(item => <div key={item.id} className="rounded-2xl border border-border bg-muted/40 p-4"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="font-medium">{item.serviceName}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.startsAt).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-secondary px-2 py-1 text-[10px] uppercase tracking-[.12em] text-foreground">{item.status}</span><span className="text-sm font-medium">{formatMoney(item.priceAmount, item.currency)}</span></div></div></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No past appointments yet.</p>}</div></div>}</section>}</main></>;
}
function StepLabel({n,text}:{n:string;text:string}) {const {t}=useLanguage();return <h2 className="flex items-center gap-3 text-sm font-medium"><span className="mono text-[10px] text-primary">{n}</span>{t(text)}</h2>}

type GuestManagedBooking = { bookingReference:string; customerName:string; serviceName:string; startsAt:string; endsAt:string; timezone:string; status:string; durationMinutes:number; priceAmount:number; currency:string; canCancel:boolean };
export function GuestBookingManagementPage() {
  const [token,setToken]=useState(''); const [booking,setBooking]=useState<GuestManagedBooking|null>(null); const [error,setError]=useState(''); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [cancelled,setCancelled]=useState(false);
  useEffect(()=>{const query=new URLSearchParams(window.location.search);const value=query.get('token')||'';setToken(value);window.history.replaceState({},'',`${window.location.pathname}${window.location.hash}`);if(!value){setError('This booking link is missing or invalid.');setLoading(false);return;}void fetch(`/api/guest-bookings/manage?token=${encodeURIComponent(value)}`,{credentials:'include',headers:{'Cache-Control':'no-store'}}).then(async response=>{const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.error||'This booking link is invalid or expired.');setBooking(payload as GuestManagedBooking)}).catch(e=>setError((e as Error).message)).finally(()=>setLoading(false));},[]);
  const cancel=async()=>{if(!token||!window.confirm('Cancel this appointment? This will release the appointment time.'))return;setSaving(true);setError('');try{const response=await fetch(`/api/guest-bookings/manage/cancel?token=${encodeURIComponent(token)}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'}});const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.error||'The appointment could not be cancelled.');setCancelled(true);setBooking(current=>current?{...current,status:'cancelled',canCancel:false}:null);}catch(e){setError((e as Error).message)}finally{setSaving(false)}};
  return <><Meta title="Manage your booking" description="Review or cancel your appointment."/><main className="page-enter mx-auto max-w-3xl px-5 py-16 md:py-24"><section className="rounded-[2rem] border border-border bg-card px-6 py-10 md:px-12"><p className="mono text-[10px] tracking-[.2em] text-primary">GUEST BOOKING</p><h1 className="serif mt-3 text-5xl">Manage your visit.</h1>{loading?<p className="mt-6 text-sm text-muted-foreground">Loading booking details…</p>:error&&!booking?<p className="mt-6 rounded-xl bg-destructive/5 p-4 text-sm text-destructive" role="alert">{error}</p>:booking&&<><div className="mt-7 rounded-2xl bg-secondary/70 p-5"><p className="text-xs text-muted-foreground">{booking.customerName}</p><h2 className="serif mt-1 text-3xl">{booking.serviceName}</h2><p className="mt-3 text-sm">{new Intl.DateTimeFormat(undefined,{dateStyle:'full',timeStyle:'short',timeZone:booking.timezone}).format(new Date(booking.startsAt))}</p><div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-border pt-4 text-xs"><span>Reference <strong className="mono ml-2">{booking.bookingReference}</strong></span><span className="capitalize">{booking.status.replaceAll('_',' ')}</span><span>{formatMoney(booking.priceAmount,booking.currency)}</span></div></div>{cancelled&&<p className="mt-5 rounded-xl bg-primary/5 p-4 text-sm" role="status">Your appointment has been cancelled.</p>}{error&&<p className="mt-5 rounded-xl bg-destructive/5 p-4 text-sm text-destructive" role="alert">{error}</p>}{booking.canCancel&&<button type="button" disabled={saving} onClick={()=>void cancel()} className="mt-6 rounded-full border border-destructive/40 px-5 py-3 text-sm text-destructive disabled:opacity-50">{saving?'Cancelling…':'Cancel appointment'}</button>}{!booking.canCancel&&!cancelled&&<p className="mt-5 text-sm text-muted-foreground">Online cancellation is no longer available for this appointment. Please contact the spa for help.</p>}</>}<Link href="/book" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground">Book another visit <ArrowRight size={15}/></Link></section></main></>;
}

export function ConfirmationPage() {
  const [confirmation,setConfirmation]=useState<BookingConfirmation|null>(null);
  useEffect(()=>{try{const value=sessionStorage.getItem('stillroom-confirmation');if(value)setConfirmation(JSON.parse(value) as BookingConfirmation)}catch{setConfirmation(null)}},[]);
  return <><Meta title="Booking confirmed" description="Your appointment booking details."/><main className="page-enter mx-auto max-w-3xl px-5 py-16 md:py-24"><div className="rounded-[2rem] border border-border bg-card px-6 py-12 text-center md:px-14"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-primary"><Check size={28}/></div>{confirmation?<><p className="mono mt-6 text-[10px] tracking-[.2em] text-primary">BOOKING {confirmation.status.toUpperCase()}</p><h1 className="serif mt-3 text-5xl md:text-6xl">Your pause is on the calendar.</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Your booking details are below. A confirmation has been created using the live schedule.</p><div className="mx-auto mt-9 max-w-md rounded-2xl bg-secondary/70 p-5 text-start"><div className="flex justify-between border-b border-border py-3"><span className="text-sm text-muted-foreground">Reference</span><span className="mono text-sm">{confirmation.bookingReference}</span></div><div className="flex justify-between border-b border-border py-3"><span className="text-sm text-muted-foreground">Treatment</span><span className="text-sm">{confirmation.serviceName}</span></div><div className="flex justify-between border-b border-border py-3"><span className="text-sm text-muted-foreground">Date & time</span><span className="text-right text-sm">{new Date(confirmation.startsAt).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span></div><div className="flex justify-between py-3"><span className="text-sm text-muted-foreground">Price</span><span className="text-sm">{formatMoney(confirmation.priceAmount,confirmation.currency)}</span></div></div><p className="mt-5 text-xs text-muted-foreground">Keep your reference for your records. The confirmation is saved only in this browser for reload support.</p></>:<><p className="mono mt-6 text-[10px] tracking-[.2em] text-primary">NO SAVED CONFIRMATION</p><h1 className="serif mt-3 text-5xl">Ready when you are.</h1><p className="mt-4 text-sm text-muted-foreground">We couldn't find a confirmation in this browser. Start a new booking to reserve a time.</p></>}<Link href="/book" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-4 text-sm text-primary-foreground">Book another visit <ArrowRight size={15}/></Link></div></main></>;
}

export function PoliciesPage({privacy=false}:{privacy?:boolean}) {
  const profile=useGetSpaProfile();
  const heading=privacy?'Privacy':'Plan your visit';
  return <><Meta title={heading} description={`${heading} information and setup placeholders.`}/><main className="page-enter mx-auto max-w-[1100px] px-5 py-14 md:px-10 md:py-20"><IntroTitle eyebrow={privacy?'YOUR INFORMATION':'BEFORE YOU ARRIVE'} title={privacy?'Privacy, plainly.':'The details that make a visit easy.'} text={privacy?'This is a privacy information template for the spa platform. Business-specific practices have not yet been supplied.':'A few practical notes so you can arrive feeling at ease. Current business information and policies are setup placeholders.'}/><div className="mt-10 rounded-2xl border border-accent/60 bg-accent/30 p-5 text-sm leading-6"><strong>Demo/setup notice:</strong> Replace all seed information with approved business details before launch. This page is not legal advice and should not be treated as a final legal policy.</div><div className="mt-8 grid gap-5 md:grid-cols-2"><InfoPanel title={privacy?'Information you provide':'Location & contact'}><p>{privacy?'Booking details submitted through this site are used to create and manage an appointment. The exact collection, storage, retention, and sharing practices must be confirmed by the business.':profile.data?`${profile.data.address}, ${profile.data.city}, ${profile.data.region}`:'Loading setup address…'}</p>{!privacy&&<p className="mt-3">Email: {profile.data?.contactEmail||'Loading'}<br/>Phone: {profile.data?.contactPhone||'Loading'}</p>}</InfoPanel><InfoPanel title={privacy?'Cookies & service providers':'Hours'}><p>{privacy?'The platform may use essential browser storage for booking confirmation support and authentication. Confirm analytics, cookie, and service-provider disclosures with the business.':profile.data?.openingHours||'Loading hours…'}</p>{!privacy&&<p className="mt-3">Timezone: {profile.data?.timezone||'Loading'}</p>}</InfoPanel><InfoPanel title={privacy?'Your choices':'Cancellation policy'}><p>{privacy?'Contact the business using the setup contact details to ask about access, correction, deletion, or privacy concerns. Response timelines and applicable rights must be verified.':profile.data?.cancellationPolicy||'Loading cancellation terms…'}</p></InfoPanel><InfoPanel title={privacy?'Policy updates':'Accessibility & questions'}><p>{privacy?'This template may be revised when approved privacy practices are available. The final version should state an effective date and any applicable jurisdiction-specific details.':'If you have a question or access need, reach out before booking. Contact information shown here is placeholder seed data until verified.'}</p></InfoPanel></div><div className="mt-8 rounded-2xl bg-secondary/75 p-5 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Not legal advice.</strong> This template is for product setup only. Have qualified counsel review final privacy notices and service/cancellation terms.</div></main></>;
}
function InfoPanel({title,children}:{title:string;children:ReactNode}) { return <section className="rounded-2xl border border-border bg-card p-6"><h2 className="serif text-3xl">{title}</h2><div className="mt-4 text-sm leading-6 text-muted-foreground">{children}</div></section> }

function DashboardInner() {
  const dashboard=useGetManagerDashboard();
  const bookings=useListManagerBookings({date:dateLocal(new Date())});
  const staff=useListManagerStaff();
  const qc=useQueryClient();
  const update=useUpdateBookingStatus();
  const assign=useAssignBookingStaff();
  const [assignmentMessage,setAssignmentMessage]=useState('');
  const [assignmentError,setAssignmentError]=useState('');
  const retry=()=>{void dashboard.refetch();void bookings.refetch()};
  const change=(booking:ManagerBooking,status:'confirmed'|'checked_in'|'completed'|'cancelled'|'no_show')=>update.mutate({id:booking.id,data:{status}},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getListManagerBookingsQueryKey({date:dateLocal(new Date())})});void qc.invalidateQueries({queryKey:getGetManagerDashboardQueryKey()});void qc.invalidateQueries({queryKey:['audit-logs']})}});
  const assignStaff=(booking:ManagerBooking, staffId:string|null)=> {
    setAssignmentMessage(''); setAssignmentError('');
    assign.mutate({id:booking.id,data:{staffId}},{onSuccess:()=>{setAssignmentMessage(`Therapist assignment updated for ${booking.bookingReference}.`);void qc.invalidateQueries({queryKey:getListManagerBookingsQueryKey({date:dateLocal(new Date())})});void qc.invalidateQueries({queryKey:getGetManagerDashboardQueryKey()});void qc.invalidateQueries({queryKey:['audit-logs']})},onError:()=>setAssignmentError(`Could not update therapist assignment for ${booking.bookingReference}. Please try again.`)});
  };
  const statusLabel=(s:string)=>s.replaceAll('_',' ');
  return <div className="mt-8">{dashboard.isLoading||bookings.isLoading?<LoadingBlock label="Loading today's schedule"/>:dashboard.isError||bookings.isError?<ErrorBlock retry={retry}/>:<><div className="grid gap-4 sm:grid-cols-3">{[['Today',dashboard.data?.todayCount],['Awaiting',dashboard.data?.pendingCount],['Completed',dashboard.data?.completedCount]].map(([label,value])=><div key={String(label)} className="rounded-2xl border border-border bg-card p-5"><p className="mono text-[9px] tracking-[.16em] text-muted-foreground">{label}</p><p className="serif mt-2 text-4xl">{value ?? '—'}</p></div>)}</div><div className="mt-5 rounded-2xl bg-primary p-6 text-primary-foreground md:flex md:items-center md:justify-between"><div><p className="mono text-[9px] tracking-[.18em] text-primary-foreground/60">UP NEXT</p>{dashboard.data?.nextBooking?<><p className="serif mt-2 text-3xl">{dashboard.data.nextBooking.customerName}</p><p className="mt-1 text-sm text-primary-foreground/75">{dashboard.data.nextBooking.serviceName} · {new Date(dashboard.data.nextBooking.startsAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</p></>:<p className="serif mt-2 text-3xl">No upcoming booking</p>}</div><CalendarDays className="mt-4 text-primary-foreground/55 md:mt-0" size={34}/></div><div className="mt-10"><div className="flex items-end justify-between"><div><p className="mono text-[9px] tracking-[.18em] text-primary">LIVE APPOINTMENTS</p><h2 className="serif mt-2 text-4xl">Today's schedule</h2></div><span className="text-xs text-muted-foreground">{new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span></div>{assignmentMessage&&<p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-xs text-primary" role="status" data-testid="status-assignment-success">{assignmentMessage}</p>}{assignmentError&&<p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive" role="alert" data-testid="status-assignment-error">{assignmentError}</p>}{Array.isArray(bookings.data)&&bookings.data.length?<div className="mt-5 space-y-3">{bookings.data.map(booking=><div key={booking.id} className="rounded-2xl border border-border bg-card p-4 md:flex md:items-center md:gap-5"><div className="mono w-20 shrink-0 text-sm">{new Date(booking.startsAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</div><div className="min-w-0 flex-1"><p className="font-medium">{booking.customerName}<span className="ml-2 text-[10px] text-muted-foreground">#{booking.bookingReference}</span></p><p className="mt-1 text-xs text-muted-foreground">{booking.serviceName} · {booking.customerEmail} · {booking.customerPhone}</p><p className="mt-1 text-[11px] text-primary">{booking.staffName ? `With ${booking.staffName}` : 'No therapist assigned'}</p></div><div className="my-3 flex flex-wrap items-center gap-2 md:my-0"><span className="inline-block rounded-full bg-secondary px-3 py-1.5 text-[10px] capitalize">{statusLabel(booking.status)}</span><label className="sr-only" htmlFor={`assign-${booking.id}`}>Assign therapist to {booking.customerName}</label><select id={`assign-${booking.id}`} value={(Array.isArray(staff.data)?staff.data:[]).find(person=>person.displayName===booking.staffName)?.id||''} onChange={event=>assignStaff(booking,event.target.value||null)} disabled={assign.isPending||staff.isLoading||staff.isError} className="max-w-[190px] rounded-full border border-input bg-background px-3 py-2 text-[10px]" data-testid={`select-assign-staff-${booking.id}`}><option value="">Unassigned</option>{(Array.isArray(staff.data)?staff.data:[]).filter(person=>person.isActive&&(person.serviceIds.length===0||person.serviceIds.some(id=>id===booking.id))).map((person:StaffProfile)=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></div><div className="flex flex-wrap gap-2 md:ml-2">{booking.status==='pending'&&<StatusAction label="Confirm" onClick={()=>change(booking,'confirmed')} disabled={update.isPending}/>} {booking.status==='confirmed'&&<StatusAction label="Check in" onClick={()=>change(booking,'checked_in')} disabled={update.isPending}/>} {booking.status==='checked_in'&&<StatusAction label="Complete" onClick={()=>change(booking,'completed')} disabled={update.isPending}/>} {['pending','confirmed'].includes(booking.status)&&<button onClick={()=>{if(window.confirm(`Cancel booking ${booking.bookingReference}?`))change(booking,'cancelled')}} className="rounded-full border border-border px-3 py-2 text-[10px] hover:bg-destructive/10" data-testid={`button-cancel-${booking.id}`}>Cancel</button>}</div></div>)}</div>:<div className="mt-5 rounded-2xl border border-dashed border-border p-10 text-center"><CalendarDays className="mx-auto text-primary" size={28}/><p className="serif mt-3 text-3xl">A clear day, so far.</p><p className="mt-2 text-sm text-muted-foreground">There are no bookings returned for today.</p></div>}{staff.isError&&<p className="mt-3 text-xs text-muted-foreground">Therapist roster could not load. Refresh to retry assignments.</p>}</div></>}</div>;
}
function StatusAction({label,onClick,disabled}:{label:string;onClick:()=>void;disabled:boolean}) { return <button onClick={onClick} disabled={disabled} className="rounded-full bg-primary px-4 py-2 text-[10px] text-primary-foreground disabled:opacity-50" data-testid={`button-status-${label.toLowerCase().replaceAll(' ','-')}`}>{label}</button> }

type ManagedService = { id:string; name:string; slug:string; category:string; shortDescription:string; description:string; durationMinutes:number; priceAmount:number; discountPercent:number; currency:string; imageUrl:string|null; isFeatured:boolean; isActive:boolean };
type ManagedCustomer = { id:string; name:string; email:string; phone:string; hasAccount:boolean; createdAt:string; updatedAt:string };
type ManagedStaff = { id:string; displayName:string; bio:string; clerkUserId:string|null; accountEmail:string|null; accountRole:string|null; accountDisabled:boolean; isBookable:boolean; isActive:boolean; createdAt:string; updatedAt:string };

async function managementRequest<T>(path:string, init?:RequestInit):Promise<T> {
  const response = await fetch(path, { ...init, headers:{ 'Content-Type':'application/json', ...(init?.headers||{}) }, credentials:'include' });
  const payload = await response.json().catch(()=>null) as { error?:string } & T;
  if (!response.ok) throw new Error(payload?.error || 'The management request failed.');
  return payload;
}

function useManagementFilter(eventName:string, initialValue:string) {
  const [value,setValue]=useState(initialValue);
  useEffect(()=>{const handler=(event:Event)=>setValue((event as CustomEvent<string>).detail);window.addEventListener(eventName,handler);return()=>window.removeEventListener(eventName,handler)},[eventName]);
  return value;
}
function ManagementMessage({error}:{error:string}) { const {t}=useLanguage(); return <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]"><input onChange={event=>window.dispatchEvent(new CustomEvent('management-search',{detail:event.target.value}))} placeholder={t('Search this list')} className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm"/><select defaultValue="active" onChange={event=>window.dispatchEvent(new CustomEvent('management-status',{detail:event.target.value}))} className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm"><option value="active">{t('Active')}</option><option value="inactive">{t('Disabled')}</option><option value="all">{t('All statuses')}</option></select>{error&&<p className="sm:col-span-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}</div>; }

function ServicesManagementPanel() {
  const { t } = useLanguage();
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === 'admin';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoriesList = [
    'Ongles',
    'Cheveux',
    'Cils & Sourcils',
    'Soins du visage',
    'Maquillage',
    'Coiffure & Chignon',
    'Épilation',
    'Massage',
    'Amincissement',
  ];

  const empty = {
    name: '',
    category: 'Ongles',
    customCategory: '',
    shortDescription: '',
    description: '',
    durationMinutes: 45,
    priceDT: 20,
    discountPercent: 0,
    currency: 'TND',
    imageUrl: '',
    isFeatured: false,
  };

  const [items, setItems] = useState<ManagedService[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const search = useManagementFilter('management-search', '');
  const status = useManagementFilter('management-status', 'active');

  const load = () => {
    setLoading(true);
    void managementRequest<ManagedService[]>('/api/manager/manage-services')
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const visible = items.filter(
    (item) =>
      (status === 'all' || (status === 'active' ? item.isActive : !item.isActive)) &&
      `${item.name} ${item.shortDescription} ${item.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  const handleImageFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setForm((prev) => ({ ...prev, imageUrl: optimizedDataUrl }));
        } else {
          setForm((prev) => ({ ...prev, imageUrl: src }));
        }
      };
      img.onerror = () => {
        setForm((prev) => ({ ...prev, imageUrl: src }));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const startEdit = (item: ManagedService) => {
    setEditing(item.id);
    const isStandardCat = categoriesList.includes(item.category);
    setForm({
      name: item.name,
      category: isStandardCat ? item.category : 'Autre',
      customCategory: isStandardCat ? '' : item.category,
      shortDescription: item.shortDescription || '',
      description: item.description || '',
      durationMinutes: item.durationMinutes || 30,
      priceDT: Math.round(item.priceAmount / 100),
      discountPercent: item.discountPercent || 0,
      currency: item.currency || 'TND',
      imageUrl: item.imageUrl || '',
      isFeatured: item.isFeatured ?? false,
    });
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditing(null);
    setForm(empty);
    setError('');
    setSuccess('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const resolvedCategory =
      form.category === 'Autre'
        ? form.customCategory.trim() || 'Soins'
        : form.category.trim();

    const payload = {
      name: form.name.trim(),
      category: resolvedCategory,
      shortDescription: form.shortDescription.trim(),
      description: form.description.trim() || form.shortDescription.trim(),
      durationMinutes: Number(form.durationMinutes),
      priceAmount: Math.round(Number(form.priceDT) * 100),
      discountPercent: Number(form.discountPercent),
      currency: 'TND',
      imageUrl: form.imageUrl.trim() || null,
      isFeatured: form.isFeatured,
    };

    try {
      const path = editing
        ? `/api/manager/services/${editing}`
        : '/api/manager/services';
      await managementRequest<{ id: string }>(path, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess(
        editing
          ? 'Le soin a été mis à jour avec succès dans la base de données !'
          : 'Le nouveau soin a été enregistré avec succès en base de données !',
      );
      resetForm();
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const disable = async (id: string, currentStatus: boolean) => {
    const action = currentStatus ? 'désactiver' : 'réactiver';
    if (!window.confirm(`Voulez-vous ${action} cette prestation ?`)) return;
    try {
      await managementRequest(`/api/manager/services/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_400px]">
      {/* Liste des soins */}
      <div className="rounded-[1.5rem] border border-border bg-card p-5 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mono text-[9px] tracking-[.18em] text-primary">BASE DE DONNÉES DU SALON</p>
            <h2 className="serif mt-2 text-4xl">Catalogue des Prestations</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {items.length} prestations enregistrées en base de données
            </p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 transition"
          >
            <Plus size={14} /> Nouveau soin
          </button>
        </div>

        <ManagementMessage error={error} />
        {success && (
          <p className="mt-4 rounded-xl border border-emerald-600/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-600 font-medium" role="status">
            {success}
          </p>
        )}

        {loading ? (
          <LoadingBlock label="Chargement des soins..." />
        ) : (
          <div className="mt-6 space-y-3 max-h-[750px] overflow-y-auto pe-1">
            {visible.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 transition ${
                  item.isActive ? 'border-border bg-card hover:bg-secondary/30' : 'border-dashed border-border opacity-60 bg-muted/20'
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex gap-3">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-14 w-14 rounded-xl object-cover shrink-0 border border-border"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-secondary grid place-items-center shrink-0 border border-border">
                        <Flower2 size={24} className="text-primary/40" />
                      </div>
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-sm">{item.name}</p>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-foreground font-medium">
                          {item.category}
                        </span>
                        {item.isFeatured && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary font-semibold">
                            À la une
                          </span>
                        )}
                        {!item.isActive && (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                            Désactivé
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                        {item.shortDescription}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className="font-semibold text-primary">{Math.round(item.priceAmount * (100-item.discountPercent) / 10000)} dt</span>{item.discountPercent>0&&<><del className="text-muted-foreground">{Math.round(item.priceAmount/100)} dt</del><span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">-{item.discountPercent}%</span></>}
                        <span className="text-muted-foreground">• {item.durationMinutes} min</span>
                        <span className="text-[10px] text-muted-foreground mono">
                          {item.imageUrl ? 'Photo configurée' : 'Pas de photo'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 self-end md:self-start">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="rounded-full border border-border p-2 hover:bg-secondary transition"
                      aria-label={`Modifier ${item.name}`}
                      title="Modifier ce soin"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void disable(item.id, item.isActive)}
                      className={`rounded-full border p-2 transition ${
                        item.isActive
                          ? 'border-border text-destructive hover:bg-destructive/10'
                          : 'border-border text-emerald-600 hover:bg-emerald-50'
                      }`}
                      aria-label={`Statut ${item.name}`}
                      title={item.isActive ? 'Désactiver' : 'Réactiver'}
                    >
                      {item.isActive ? <Trash2 size={14} /> : <Check size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulaire d'ajout / modification */}
      <form onSubmit={save} className="h-fit rounded-[1.5rem] border border-border bg-card p-5 md:p-7 shadow-sm sticky top-24">
        <div className="flex items-center justify-between">
          <p className="mono text-[9px] tracking-[.18em] text-primary">
            {editing ? 'MODIFICATION DE SOIN' : 'NOUVEAU SOIN'}
          </p>
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="text-[11px] text-muted-foreground underline hover:text-foreground"
            >
              Annuler
            </button>
          )}
        </div>
        <h3 className="serif text-2xl mt-1">
          {editing ? 'Modifier la prestation' : 'Créer une prestation'}
        </h3>

        <div className="mt-5 grid gap-3.5">
          {/* Nom du soin */}
          <label className="grid gap-1 text-xs font-medium">
            Nom du soin *
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Hydrafacial Prestige"
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            />
          </label>

          {/* Catégorie */}
          <div className="grid gap-1 text-xs font-medium">
            <label>Catégorie *</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            >
              {categoriesList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="Autre">Autre (personnalisée)</option>
            </select>
            {form.category === 'Autre' && (
              <input
                required
                value={form.customCategory}
                onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                placeholder="Nom de la nouvelle catégorie"
                className="mt-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            )}
          </div>

          {/* Description courte */}
          <label className="grid gap-1 text-xs font-medium">
            Description courte (affichée sur la carte) *
            <input
              required
              value={form.shortDescription}
              onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
              placeholder="Ex: Nettoyage profond et soin éclat du visage."
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            />
          </label>

          {/* Description complète */}
          <label className="grid gap-1 text-xs font-medium">
            Description détaillée (page du soin)
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Protocole, étapes et bienfaits détaillés de la séance..."
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          {/* Gestion de l'image (Upload ou URL) */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Photo du soin</span>
              <span className="text-[10px] text-primary mono bg-primary/10 px-2 py-0.5 rounded-full">
                800 × 600 px recommandé
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-4">
              Formats recommandés : JPEG, PNG ou WebP (ratio 4:3 ou 16:9, max 3 Mo).
            </p>

            {/* Input URL direct */}
            <input
              type="text"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="URL de l'image (https://...)"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"
            />

            {/* Bouton Upload local */}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 rounded-xl border border-border bg-background py-2 text-xs font-medium hover:bg-secondary transition text-center"
              >
                📁 Choisir une photo locale
              </button>
              {form.imageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...form, imageUrl: '' });
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="rounded-xl border border-destructive/30 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition"
                >
                  Supprimer
                </button>
              )}
            </div>

            {/* Aperçu image */}
            {form.imageUrl && (
              <div className="relative mt-2 overflow-hidden rounded-xl border border-border bg-black/5">
                <img
                  src={form.imageUrl}
                  alt="Aperçu du soin"
                  className="h-32 w-full object-cover"
                />
                <span className="absolute bottom-1.5 start-2 rounded bg-black/60 px-2 py-0.5 text-[9px] text-white backdrop-blur">
                  Aperçu en direct
                </span>
              </div>
            )}
          </div>

          {/* Tarif en Dinars et Durée */}
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs font-medium">
              Tarif en Dinars (DT) *
              <div className="relative">
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={form.priceDT}
                  onChange={(e) => setForm({ ...form, priceDT: Number(e.target.value) })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm pe-10 font-semibold"
                />
                <span className="absolute end-3 top-2.5 text-xs text-muted-foreground font-medium">
                  dt
                </span>
              </div>
            </label>

            <label className="grid gap-1 text-xs font-medium">
              Durée (minutes) *
              <div className="relative">
                <input
                  required
                  type="number"
                  min="5"
                  step="5"
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm pe-12"
                />
                <span className="absolute end-3 top-2.5 text-xs text-muted-foreground">
                  min
                </span>
              </div>
            </label>
          </div>

          {isAdmin && <label className="grid gap-1 text-xs font-medium">Pourcentage de remise (%)<input type="number" min="0" max="100" step="1" value={form.discountPercent} onChange={(e)=>setForm({...form,discountPercent:Number(e.target.value)})} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" /></label>}

          {/* Mettre à la une */}
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
              className="accent-primary h-4 w-4 rounded"
            />
            Mettre en avant sur la page d'accueil (Top Soins)
          </label>

          {/* Bouton Enregistrer */}
          <button
            disabled={saving}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-95 transition disabled:opacity-60 shadow-sm"
          >
            {saving ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <Check size={16} />
            )}
            {editing ? 'Enregistrer les modifications' : 'Ajouter la prestation'}
          </button>
        </div>
      </form>
    </section>
  );
}

function LegacyStaffManagementPanel() {
  const [items,setItems]=useState<ManagedStaff[]>([]); const [form,setForm]=useState({displayName:'',bio:'',isBookable:true}); const [editing,setEditing]=useState<string|null>(null); const [error,setError]=useState(''); const [loading,setLoading]=useState(true);
  const search=useManagementFilter('management-search',''); const status=useManagementFilter('management-status','active');
  const load=()=>{setLoading(true);void managementRequest<ManagedStaff[]>('/api/manager/directory').then(setItems).catch(e=>setError(e.message)).finally(()=>setLoading(false));}; useEffect(load,[]);
  const visible=items.filter(item=>(status==='all'||(status==='active'?item.isActive:!item.isActive))&&`${item.displayName} ${item.bio}`.toLowerCase().includes(search.toLowerCase()));
  const save=async(event:FormEvent)=>{event.preventDefault();setError('');try{await managementRequest(editing?`/api/manager/directory/${editing}`:'/api/manager/directory',{method:editing?'PATCH':'POST',body:JSON.stringify(form)});setEditing(null);setForm({displayName:'',bio:'',isBookable:true});load()}catch(e){setError((e as Error).message)}};
  const disable=async(id:string)=>{if(!window.confirm('Disable this staff profile?'))return;try{await managementRequest(`/api/manager/directory/${id}`,{method:'DELETE'});load()}catch(e){setError((e as Error).message)}};
  return <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_360px]"><div className="rounded-[1.5rem] border border-border bg-card p-5 md:p-7"><div className="flex items-end justify-between"><div><p className="mono text-[9px] tracking-[.18em] text-primary">STAFF DIRECTORY</p><h2 className="serif mt-2 text-4xl">People</h2></div><Users className="text-primary" size={24}/></div><ManagementMessage error={error}/>{loading?<LoadingBlock label="Loading staff"/>:<div className="mt-6 space-y-3">{items.map(item=><div key={item.id} className={`flex items-start justify-between rounded-2xl border p-4 ${item.isActive?'border-border':'border-dashed border-border opacity-60'}`}><div><p className="font-medium">{item.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{item.bio||'No bio yet'} · {item.isBookable?'Bookable':'Not bookable'}{!item.isActive?' · Disabled':''}</p></div><div className="flex gap-2"><button type="button" onClick={()=>{setEditing(item.id);setForm({displayName:item.displayName,bio:item.bio,isBookable:item.isBookable})}} className="rounded-full border border-border p-2" aria-label={`Edit ${item.displayName}`}><Pencil size={14}/></button>{item.isActive&&<button type="button" onClick={()=>void disable(item.id)} className="rounded-full border border-border p-2 text-destructive" aria-label={`Disable ${item.displayName}`}><Trash2 size={14}/></button>}</div></div>)}</div>}</div><form onSubmit={save} className="h-fit rounded-[1.5rem] border border-border bg-card p-5 md:p-7"><p className="mono text-[9px] tracking-[.18em] text-primary">{editing?'EDIT STAFF MEMBER':'ADD STAFF MEMBER'}</p><div className="mt-5 grid gap-3"><input required value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})} placeholder="Display name" className="rounded-xl border border-input bg-background px-3 py-3 text-sm"/><textarea value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} placeholder="Short bio" rows={4} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"/><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.isBookable} onChange={e=>setForm({...form,isBookable:e.target.checked})} className="accent-primary"/> Available for bookings</label><button className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground"><Check size={15}/> {editing?'Save changes':'Create staff profile'}</button></div></form></section>;
}

function LegacyStaffAccountPanel() {
  const empty={displayName:'',accountEmail:'',password:'',role:'user',bio:'',isBookable:true,isActive:true,accountDisabled:false};
  const [items,setItems]=useState<ManagedStaff[]>([]); const [form,setForm]=useState(empty); const [editing,setEditing]=useState<string|null>(null); const [error,setError]=useState(''); const [loading,setLoading]=useState(true);
  const search=useManagementFilter('management-search',''); const status=useManagementFilter('management-status','active');
  const load=()=>{setLoading(true);void managementRequest<ManagedStaff[]>('/api/manager/directory').then(setItems).catch(e=>setError(e.message)).finally(()=>setLoading(false));}; useEffect(load,[]);
  const visible=items.filter(item=>(status==='all'||(status==='active'?item.isActive&&!item.accountDisabled:!item.isActive||item.accountDisabled))&&`${item.displayName} ${item.accountEmail||''} ${item.accountRole||''}`.toLowerCase().includes(search.toLowerCase()));
  const save=async(event:FormEvent)=>{event.preventDefault();setError('');try{const payload={...form,password:form.password||undefined,accountEmail:form.accountEmail||undefined};await managementRequest(editing?`/api/manager/directory/${editing}`:'/api/manager/directory',{method:editing?'PATCH':'POST',body:JSON.stringify(payload)});setEditing(null);setForm(empty);load()}catch(e){setError((e as Error).message)}};
  const disable=async(item:ManagedStaff)=>{if(!window.confirm(`Disable ${item.displayName}'s sign-in account?`))return;try{await managementRequest(`/api/manager/directory/${item.id}`,{method:'PATCH',body:JSON.stringify({isActive:false,accountDisabled:true})});load()}catch(e){setError((e as Error).message)}};
  return <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_380px]"><div className="rounded-[1.5rem] border border-border bg-card p-5 md:p-7"><div className="flex items-end justify-between"><div><p className="mono text-[9px] tracking-[.18em] text-primary">STAFF ACCOUNTS</p><h2 className="serif mt-2 text-4xl">People & access</h2></div><Users className="text-primary" size={24}/></div><ManagementMessage error={error}/>{loading?<LoadingBlock label="Loading staff accounts"/>:<div className="mt-6 space-y-3">{visible.map(item=><div key={item.id} className={`rounded-2xl border p-4 ${item.isActive&&!item.accountDisabled?'border-border':'border-dashed border-border opacity-60'}`}><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{item.accountEmail||'No sign-in account'} · {item.accountRole||'user'} · {item.isBookable?'Bookable':'Not bookable'}</p><p className="mt-1 text-[10px] uppercase tracking-[.12em] text-muted-foreground">{item.isActive&&!item.accountDisabled?'Active':'Disabled'}</p></div><div className="flex gap-2"><button type="button" onClick={()=>{setEditing(item.id);setForm({displayName:item.displayName,accountEmail:item.accountEmail||'',password:'',role:item.accountRole||'user',bio:item.bio,isBookable:item.isBookable,isActive:item.isActive,accountDisabled:item.accountDisabled})}} className="rounded-full border border-border p-2" aria-label={`Edit ${item.displayName}`}><Pencil size={14}/></button>{item.isActive&&!item.accountDisabled&&<button type="button" onClick={()=>void disable(item)} className="rounded-full border border-border p-2 text-destructive" aria-label={`Disable ${item.displayName}`}><Trash2 size={14}/></button>}</div></div></div>)}</div>}</div><form onSubmit={save} className="h-fit rounded-[1.5rem] border border-border bg-card p-5 md:p-7"><p className="mono text-[9px] tracking-[.18em] text-primary">{editing?'EDIT STAFF ACCOUNT':'CREATE STAFF ACCOUNT'}</p><div className="mt-5 grid gap-3"><input required value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})} placeholder="Display name" className="rounded-xl border border-input bg-background px-3 py-3 text-sm"/><input required={!editing} disabled={Boolean(editing)} type="email" value={form.accountEmail} onChange={e=>setForm({...form,accountEmail:e.target.value})} placeholder="Account email" className="rounded-xl border border-input bg-background px-3 py-3 text-sm disabled:opacity-60"/><input required={!editing} minLength={8} type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder={editing?'New password (optional)':'Temporary password'} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"/><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"><option value="user">Staff user</option><option value="manager">Manager</option><option value="admin">Admin</option></select><textarea value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} placeholder="Short bio" rows={3} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"/><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.isBookable} onChange={e=>setForm({...form,isBookable:e.target.checked})} className="accent-primary"/> Available for bookings</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.accountDisabled} onChange={e=>setForm({...form,accountDisabled:e.target.checked,isActive:!e.target.checked})} className="accent-primary"/> Disable sign-in account</label><button className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground"><Check size={15}/> {editing?'Save account changes':'Create staff account'}</button></div></form></section>;
}

function CustomerManagementPanel() {
  const {t}=useLanguage();
  const [items,setItems]=useState<ManagedCustomer[]>([]); const [error,setError]=useState(''); const [loading,setLoading]=useState(true); const [editing,setEditing]=useState<string|null>(null); const [form,setForm]=useState({name:'',email:'',phone:''});
  const [accountType,setAccountType]=useState<'all'|'guest'|'account'>('all');
  const search=useManagementFilter('management-search','');
  const load=()=>{setLoading(true);void managementRequest<ManagedCustomer[]>('/api/manager/customers').then(setItems).catch(e=>setError(e.message)).finally(()=>setLoading(false));}; useEffect(load,[]);
  const visible=items.filter(item=>(accountType==='all'||(accountType==='account'?item.hasAccount:!item.hasAccount))&&`${item.name} ${item.email} ${item.phone}`.toLowerCase().includes(search.toLowerCase())).map(item=>({...item,accountLabel:t(item.hasAccount?'With an account':'Guest')}));
  const save=async(event:FormEvent)=>{event.preventDefault();try{await managementRequest(`/api/manager/customers/${editing}`,{method:'PATCH',body:JSON.stringify(form)});setEditing(null);load()}catch(e){setError((e as Error).message)}};
  return <section className="mt-8 rounded-[1.5rem] border border-border bg-card p-5 md:p-7"><div className="flex items-end justify-between"><div><p className="mono text-[9px] tracking-[.18em] text-primary">{t("CUSTOMER RECORDS")}</p><h2 className="serif mt-2 text-4xl">{t("Customers")}</h2></div><Users className="text-primary" size={24}/></div><ManagementMessage error={error}/><div className="mt-3 flex flex-wrap items-center gap-3"><label className="text-xs text-muted-foreground" htmlFor="customer-account-filter">{t("Account type")}</label><select id="customer-account-filter" value={accountType} onChange={event=>setAccountType(event.target.value as 'all'|'guest'|'account')} className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm"><option value="all">{t("All customers")}</option><option value="guest">{t("Guests")}</option><option value="account">{t("With an account")}</option></select></div>{loading?<LoadingBlock label="Loading customers"/>:<div className="mt-6 overflow-x-auto"><table className="w-full min-w-[720px] text-start text-sm"><thead><tr className="border-b border-border text-[10px] tracking-[.12em] text-muted-foreground"><th className="py-3 font-normal">{t("NAME")}</th><th className="py-3 font-normal">{t("EMAIL")}</th><th className="py-3 font-normal">{t("PHONE")}</th><th className="py-3 font-normal">{t("ACCOUNT")}</th><th className="py-3 font-normal">{t("ACTION")}</th></tr></thead><tbody>{visible.map(item=><tr key={item.id} className="border-b border-border/70"><td className="py-4">{item.name}</td><td className="py-4 text-muted-foreground">{item.email}</td><td className="py-4 text-muted-foreground">{item.phone}</td><td className="py-4 text-xs">{item.accountLabel}</td><td className="py-4"><button type="button" onClick={()=>{setEditing(item.id);setForm({name:item.name,email:item.email,phone:item.phone})}} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs"><Pencil size={13}/> {t("Edit")}</button></td></tr>)}</tbody></table></div>}{editing&&<div className="fixed inset-0 z-50 grid place-items-center bg-primary/20 p-5"><form onSubmit={save} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"><h3 className="serif text-3xl">{t("Edit customer")}</h3><div className="mt-5 grid gap-3"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"/><input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"/><input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"/><div className="flex justify-end gap-2"><button type="button" onClick={()=>setEditing(null)} className="rounded-full border border-border px-4 py-2 text-xs">{t("Cancel")}</button><button className="rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground">{t("Save")}</button></div></div></form></div>}</section>;
}

export function ManagerPage() {
  const {t}=useLanguage();
  const [tab,setTab]=useState<'overview'|'staff'|'customers'|'services'|'audit'>('overview');
  const { user } = useUser();
  const tabs=[['overview',t('Overview')],['staff',t('Staff')],['customers',t('Customers')],['services',t('Treatments')],['audit',t('Audit logs')]] as const;
  return <><Meta title={tab==='overview'?"Today's schedule":tabs.find(item=>item[0]===tab)?.[1]||'Staff desk'} description="Staff schedule and appointment operations."/><main className="page-enter mx-auto max-w-[1320px] px-5 py-12 md:px-10 md:py-16"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mono text-[10px] tracking-[.2em] text-primary">{t('Staff desk')}</p><h1 className="serif mt-3 text-5xl md:text-6xl">{tab==='overview'?t('Today, at a glance.'):tabs.find(item=>item[0]===tab)?.[1]}</h1><p className="mt-3 text-sm text-muted-foreground">{t('Manage the schedule, people, treatment catalog, and operational history.')}</p></div><HealthPip/></div><div className="mt-8 flex flex-wrap gap-2 border-b border-border pb-3">{tabs.map(([value,label])=><button key={value} type="button" onClick={()=>setTab(value)} className={`rounded-full px-4 py-2.5 text-xs ${tab===value?'bg-primary text-primary-foreground':'border border-border bg-card hover:bg-secondary'}`} data-testid={`tab-manager-${value}`}>{label}</button>)}</div>{tab==='overview'&&<DashboardInner/>}{tab==='staff'&&<StaffManagementPanel/>}{tab==='customers'&&<CustomerManagementPanel/>}{tab==='services'&&<ServicesManagementPanel/>}{tab==='audit'&&<AuditPage businessOnly={user?.publicMetadata?.role !== 'admin'}/>}</main></>;
}

export function AuditPage({ businessOnly = false }: { businessOnly?: boolean }) {
  const {t}=useLanguage();
  const logs=useQuery<AuditEvent[]>({
    queryKey: ['audit-logs', businessOnly],
    queryFn: async () => {
      const response = await fetch(businessOnly ? '/api/manager/audit-logs' : '/api/admin/audit-logs', { credentials: 'include' });
      const body = await response.json().catch(() => null) as AuditEvent[] | { error?: string } | null;
      if (!response.ok) {
        const message = body && !Array.isArray(body) ? body.error : undefined;
        throw new Error(message || 'Could not load audit events.');
      }
      return (body || []) as AuditEvent[];
    },
  });
  const [search,setSearch]=useState('');
  const [entityFilter,setEntityFilter]=useState('all');
  const [actorFilter,setActorFilter]=useState('all');
  const filtered=(Array.isArray(logs.data)?logs.data:[]).filter((row:AuditEvent)=>{
    const entityMatches=entityFilter==='all'||row.entityType===entityFilter;
    const normalizedActor=row.actorLabel.toLowerCase();
    const actorMatches=actorFilter==='all'||(actorFilter==='guest'?normalizedActor==='guest':actorFilter==='customer'?normalizedActor.includes('customer'):normalizedActor.includes('manager')||normalizedActor.includes('admin')||normalizedActor.includes('staff'));
    return entityMatches&&actorMatches&&`${row.actorLabel} ${row.action} ${row.entityType} ${row.entityId}`.toLowerCase().includes(search.toLowerCase());
  }).map((row:AuditEvent)=>({...row,actorLabel:t(row.actorLabel),entityType:t(row.entityType)}));
  return <><Meta title="Audit log" description="Owner audit history for operational changes."/><main className="page-enter mx-auto max-w-[1320px] px-5 py-12 md:px-10 md:py-16"><p className="mono text-[10px] tracking-[.2em] text-primary">OWNER VIEW</p><h1 className="serif mt-3 text-5xl md:text-6xl">Audit trail.</h1><p className="mt-3 text-sm text-muted-foreground">A record of actions returned by the protected service.</p><section className="mt-8 rounded-[1.5rem] border border-border bg-card p-5 md:p-7"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h2 className="serif text-3xl">Recent events</h2><p className="mt-1 text-xs text-muted-foreground">Rows below are live API data; no sample events are inserted.</p></div><div className="flex flex-wrap gap-2"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search events" className="rounded-xl border border-input bg-background px-4 py-3 text-sm md:w-56" data-testid="input-audit-search"/><select aria-label="Filter audit log by record type" value={entityFilter} onChange={e=>setEntityFilter(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"><option value="all">All records</option>{['booking','service','customer','staff','account','settings'].map(value=><option key={value} value={value}>{value[0]?.toUpperCase()}{value.slice(1)}</option>)}</select><select aria-label="Filter audit log by actor" value={actorFilter} onChange={e=>setActorFilter(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"><option value="all">All actors</option><option value="guest">{t("Guests")}</option><option value="customer">Customer accounts</option><option value="staff">Staff / admins</option></select></div></div>{logs.isLoading?<LoadingBlock label="Loading audit events"/>:logs.isError?<ErrorBlock retry={()=>void logs.refetch()}/>:filtered.length?<div className="mt-5 overflow-x-auto"><table className="w-full min-w-[690px] border-collapse text-start text-sm"><thead><tr className="border-b border-border text-[10px] tracking-[.1em] text-muted-foreground"><th className="py-3 font-normal">WHEN</th><th className="py-3 font-normal">ACTOR</th><th className="py-3 font-normal">ACTION</th><th className="py-3 font-normal">ENTITY</th><th className="py-3 font-normal">ID</th></tr></thead><tbody>{filtered.map((row:AuditEvent)=><tr key={row.id} className="border-b border-border/70"><td className="py-4 text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</td><td className="py-4">{row.actorLabel}</td><td className="py-4">{row.action}</td><td className="py-4">{row.entityType}</td><td className="mono py-4 text-xs">{row.entityId}</td></tr>)}</tbody></table></div>:<div className="py-14 text-center"><p className="serif text-3xl">Nothing to show yet.</p><p className="mt-2 text-sm text-muted-foreground">{Array.isArray(logs.data)&&logs.data.length?'No events match those filters.':'No audit events have been returned.'}</p></div>}</section></main></>;
}
