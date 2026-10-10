import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useClerk, useUser } from '@/lib/safe-clerk';
import { useTheme } from 'next-themes';
import { getIntlLocale, useLanguage } from '@/lib/i18n';
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
import { SiFacebook, SiGooglemaps, SiInstagram } from 'react-icons/si';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Flower2, HeartHandshake, Home,
  LoaderCircle, Menu, Moon, Pencil, Plus, RefreshCw, ShieldCheck, ShoppingBag, Sparkles, Sun, Trash2, Users, X,
  Phone, PhoneCall, PhoneOff, Percent, Search, CheckCircle2, XCircle, AlertCircle, Edit3, User, Filter, Star, Camera, MapPin,
} from 'lucide-react';

const BOOKING_CART_STORAGE_KEY = 'stillroom-booking-cart';
const BOOKING_CART_EVENT = 'stillroom-booking-cart-change';
const COOKIE_CONSENT_KEY = 'complexe-rouis-cookie-consent';

export function readStoredCart(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(BOOKING_CART_STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, 12) : [];
  } catch { return []; }
}

export function saveStoredCart(serviceIds: string[]) {
  try {
    localStorage.setItem(BOOKING_CART_STORAGE_KEY, JSON.stringify(serviceIds.slice(0, 12)));
    window.dispatchEvent(new Event(BOOKING_CART_EVENT));
  } catch { /* Cart still works for this page if storage is unavailable. */ }
}

export function addToCartHelper(serviceId: string) {
  const current = readStoredCart();
  if (!current.includes(serviceId)) {
    saveStoredCart([...current, serviceId]);
  }
}

function Meta({ title, description, noindex = false }: { title: string; description: string; noindex?: boolean }) {
  const { t, language } = useLanguage();
  useEffect(() => {
    const translatedTitle = `${t(title)} · Complexe Rouis`;
    const translatedDescription = t(description);
    document.title = translatedTitle;

    const setMeta = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
      let element = document.querySelector<HTMLMetaElement>(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.content = content;
    };

    setMeta('meta[name="description"]', 'name', 'description', translatedDescription);
    setMeta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex, follow' : 'index, follow');
    setMeta('meta[property="og:title"]', 'property', 'og:title', translatedTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', translatedDescription);
    setMeta('meta[property="og:url"]', 'property', 'og:url', `${window.location.origin}${window.location.pathname}`);
    setMeta('meta[property="og:locale"]', 'property', 'og:locale', language === 'ar' ? 'ar_TN' : language === 'fr' ? 'fr_TN' : 'en_US');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', translatedTitle);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', translatedDescription);

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}${window.location.pathname}`;
  }, [title, description, noindex, t, language]);
  return null;
}

function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const services = useListServices();
  const [cartIds, setCartIds] = useState<string[]>(() => readStoredCart());

  useEffect(() => {
    const update = () => setCartIds(readStoredCart());
    window.addEventListener(BOOKING_CART_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(BOOKING_CART_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  const cartServices = useMemo(() => {
    const all = Array.isArray(services.data) && services.data.length > 0 ? services.data : [];
    return cartIds.map(id => {
      const found = all.find(s => s.id === id);
      if (found) return found;
      const staticFound = ROUIS_SERVICES.find(s => s.id === id);
      if (staticFound) {
        return {
          id: staticFound.id,
          name: staticFound.name,
          category: staticFound.category,
          priceAmount: staticFound.price * 100,
          currency: 'TND',
          durationMinutes: 45,
          shortDescription: staticFound.note || '',
          discountPercent: 0,
          originalPriceAmount: staticFound.price * 100,
          isFeatured: false,
          imageUrl: null,
          slug: staticFound.id,
          description: '',
        } as Service;
      }
      return null;
    }).filter((s): s is Service => Boolean(s));
  }, [cartIds, services.data]);

  const totalPrice = cartServices.reduce((sum, item) => sum + item.priceAmount, 0);
  const totalDuration = cartServices.reduce((sum, item) => sum + item.durationMinutes, 0);

  const removeItem = (id: string) => {
    const next = cartIds.filter(item => item !== id);
    setCartIds(next);
    saveStoredCart(next);
  };

  const clearCart = () => {
    setCartIds([]);
    saveStoredCart([]);
  };

  const handleCheckout = () => {
    onClose();
    setLocation('/book');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex h-full w-full max-w-md flex-col justify-between bg-card p-6 shadow-2xl border-s border-border animate-in slide-in-from-right duration-300">
        <div>
          <div className="flex items-center justify-between border-b border-border/70 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                <ShoppingBag size={20} />
              </span>
              <div>
                <h3 className="serif text-2xl leading-none">{t("Your cart")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{cartServices.length} {t("treatment(s) selected")}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 max-h-[calc(100dvh-280px)] overflow-y-auto overscroll-contain pe-1 space-y-3">
            {cartServices.length === 0 ? (
              <div className="py-16 text-center">
                <Flower2 className="mx-auto text-muted-foreground/30" size={44} />
                <p className="serif mt-3 text-2xl">{t("Your cart is empty")}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground max-w-xs mx-auto">{t("Browse treatments and add them to build your appointment.")}</p>
                <button
                  onClick={() => { onClose(); setLocation('/services'); }}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground shadow-sm hover:opacity-95 transition"
                >
                  {t("Explore treatments")} <ArrowRight size={13} />
                </button>
              </div>
            ) : (
              cartServices.map((service, idx) => (
                <div key={`${service.id}-${idx}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-secondary/30 p-3.5 transition hover:border-primary/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight truncate">{service.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider">{service.category}</span>
                      <span aria-hidden="true">&bull;</span>
                      <span>{service.durationMinutes} min</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-primary text-sm tabular-nums">
                      {formatMoney(service.priceAmount, service.currency)}
                    </span>
                    <button
                      onClick={() => removeItem(service.id)}
                      className="rounded-full p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                      title={t("Remove")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {cartServices.length > 0 && (
          <div className="border-t border-border/80 pt-4 space-y-3 bg-card">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("Estimated treatment time")}</span>
              <span className="font-medium text-foreground">{totalDuration} min</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold">
              <span>{t("Total")}</span>
              <span className="serif text-2xl text-primary">{formatMoney(totalPrice, 'TND')}</span>
            </div>
            <button
              onClick={handleCheckout}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-medium text-primary-foreground shadow-md hover:opacity-95 transition"
            >
              <span>{t("Confirm and choose a time")}</span>
              <ArrowRight size={16} />
            </button>
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={clearCart}
                className="text-[11px] text-muted-foreground hover:text-destructive transition underline"
              >
                {t("Clear cart")}
              </button>
              <span className="text-[11px] text-muted-foreground">{t("Pay at the spa")}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HealthPip() {
  const health = useHealthCheck({ query: { refetchInterval: 60000, queryKey: getHealthCheckQueryKey() } });
  return <span className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="status-live-health">
    <span className={`h-2 w-2 rounded-full ${health.isError ? 'bg-destructive' : health.data ? 'bg-emerald-700' : 'bg-amber-500'}`} />
    {health.isLoading ? 'Connecting' : health.isError ? 'Service status unavailable' : health.data?.status || 'Online'}
  </span>;
}

function FooterExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="min-h-11 py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{children}</a>;
}

function BrandMark({ className = 'h-10 w-10' }: { className?: string }) {
  return <img src="/logo.png" alt="" width="48" height="48" className={`shrink-0 object-cover mix-blend-screen ${className}`} />;
}

function LanguageSelector({ id, className = '' }: { id: string; className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  return <div className={`relative min-w-0 ${className}`}>
    <label htmlFor={id} className="sr-only">{t('Language')}</label>
    <select
      id={id}
      aria-label={t('Language')}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      value={language}
      onChange={event => setLanguage(event.target.value as 'en' | 'fr' | 'ar')}
      className="h-10 w-full min-w-0 appearance-none rounded-full border border-border bg-card ps-3 pe-9 text-xs text-foreground shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <option value="en">English</option>
      <option value="fr">Français</option>
      <option value="ar">العربية</option>
    </select>
    <ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
  </div>;
}

export function SiteShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [cartCount, setCartCount] = useState(() => readStoredCart().length);
  const [cookieChoice, setCookieChoice] = useState<'accepted' | 'rejected' | null>(null);
  const [showCookieDetails, setShowCookieDetails] = useState(false);
  const profile = useGetSpaProfile();
  const spa = profile.data;
  const [currentLocation, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { t } = useLanguage();
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (saved === 'accepted' || saved === 'rejected') setCookieChoice(saved);
    } catch { /* Consent prompt remains available if storage is disabled. */ }
  }, []);

  const saveCookieChoice = (choice: 'accepted' | 'rejected') => {
    try { localStorage.setItem(COOKIE_CONSENT_KEY, choice); } catch { /* Keep the choice for this page view. */ }
    setCookieChoice(choice);
    setShowCookieDetails(false);
  };

  const role = typeof user?.publicMetadata?.role === 'string' ? user.publicMetadata.role : null;
  const isStaffVisible = role === 'manager' || role === 'admin';
  const nav = [
    { href: '/', label: t('Home') }, { href: '/services', label: t('Treatments') },
    { href: '/policies', label: t('Visit information') }, ...(isStaffVisible ? [{ href: '/manager', label: t('Staff') }] : []),
  ];

  return <div className="min-h-[100dvh] bg-background text-foreground">
    <div className="border-b border-border/70 bg-secondary/65 px-4 py-2 text-center text-[11px] tracking-[.08em] text-muted-foreground">
      {t('A considered beauty and wellness experience · Complexe Rouis')}
    </div>
    <header className="relative z-40 border-b border-border/70 bg-background/95 md:sticky md:top-0 md:backdrop-blur-md">
      <div className="mx-auto flex h-[76px] min-w-0 max-w-[1320px] items-center justify-between gap-2 px-3 sm:px-5 lg:px-10">
        <Link href="/" className="flex min-w-0 shrink items-center gap-2 sm:gap-3" data-testid="link-brand">
          <BrandMark className="h-10 w-10 rounded-xl" />
          <span className="min-w-0"><span className="serif block truncate text-[18px] leading-[.9] sm:text-[22px]">Complexe Rouis</span><span className="mono mt-1 hidden truncate text-[8px] tracking-[.2em] text-muted-foreground min-[370px]:block">{t('A NEIGHBORHOOD PAUSE')}</span></span>
        </Link>
        <nav className="hidden items-center gap-5 lg:gap-8 lg:flex">
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
          <button
            type="button"
            onClick={() => setCartDrawerOpen(true)}
            aria-label={`${t('Cart')}, ${cartCount}`}
            title={t("Your cart")}
            className="relative inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-foreground/80 transition hover:border-primary hover:text-primary shadow-sm"
            data-testid="link-header-cart"
          >
            <ShoppingBag size={16}/>
            <span className="hidden sm:inline font-medium">{t("Cart")}</span>
            <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {cartCount}
            </span>
          </button>
          <button className="hidden rounded-full bg-primary px-5 py-3 text-xs font-semibold tracking-wide text-primary-foreground transition hover:-translate-y-0.5 lg:block" onClick={() => setLocation('/book')} data-testid="button-header-book">{t('Find a time')} <ArrowRight className="ms-2 inline" size={14}/></button>
          <button aria-label={t('Find a time')} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-2 text-[10px] font-semibold text-primary-foreground min-[370px]:px-3 min-[370px]:text-[11px] lg:hidden" onClick={() => setLocation('/book')} data-testid="button-header-book-mobile"><span className="truncate">{t('Find a time')}</span><ArrowRight size={13} className="shrink-0"/></button>
          <LanguageSelector id="desktop-language" className="hidden w-[132px] lg:block" />
          <button type="button" onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')} className="hidden rounded-full border border-border p-2 lg:inline-flex" aria-label={t(resolvedTheme==='dark'?'Switch to light mode':'Switch to dark mode')} title={t(resolvedTheme==='dark'?'Switch to light mode':'Switch to dark mode')}>{resolvedTheme==='dark'?<Sun size={16}/>:<Moon size={16}/>}</button>
          <button type="button" aria-expanded={open} aria-controls="mobile-site-menu" className="rounded-full p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label={open ? t('Close menu') : t('Open menu')} data-testid="button-mobile-menu">{open ? <X size={21}/> : <Menu size={21}/>}</button>
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent id="mobile-site-menu" side="left" className="flex w-[min(86vw,20rem)] max-w-none flex-col gap-0 overflow-y-auto border-e border-border bg-background p-0 text-foreground shadow-2xl lg:hidden">
          <SheetHeader className="border-b border-border px-5 pb-5 pt-8 text-start">
            <div className="flex items-center gap-3 pe-8">
              <BrandMark className="h-11 w-11 rounded-xl" />
              <span className="min-w-0"><SheetTitle className="serif text-2xl font-normal">Complexe Rouis</SheetTitle><SheetDescription className="mt-1 text-[10px] tracking-[.14em]">{t('A NEIGHBORHOOD PAUSE')}</SheetDescription></span>
            </div>
          </SheetHeader>
          <div className="flex-1 px-4 py-5">
            <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[.16em] text-muted-foreground">{t('Navigation')}</p>
            <nav aria-label={t('Navigation')} className="grid gap-1.5">
              {nav.map(item => {
                const Icon = item.href === '/' ? Home : item.href === '/services' ? Flower2 : item.href === '/policies' ? MapPin : Users;
                const active = currentLocation === item.href;
                return <Link key={item.href} onClick={() => setOpen(false)} href={item.href} aria-current={active ? 'page' : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? 'bg-primary/10 font-medium text-primary' : 'text-foreground/80 hover:bg-secondary hover:text-foreground'}`}><Icon size={17} className="shrink-0" aria-hidden="true"/><span className="min-w-0 flex-1">{item.label}</span>{active && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true"/>}</Link>;
              })}
            </nav>
            <div className="mt-6 border-t border-border pt-5">
              <p className="px-3 pb-3 text-[10px] font-medium uppercase tracking-[.16em] text-muted-foreground">{t('Preferences')}</p>
              <div className="grid gap-2">
                <LanguageSelector id="mobile-language" className="w-full" />
                <button type="button" onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')} className="inline-flex min-h-11 items-center gap-3 rounded-xl px-3 text-start text-sm text-foreground/80 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={t(resolvedTheme==='dark'?'Switch to light mode':'Switch to dark mode')}>
                  {resolvedTheme==='dark'?<Sun size={17} className="shrink-0"/>:<Moon size={17} className="shrink-0"/>}<span>{t(resolvedTheme==='dark'?'Switch to light mode':'Switch to dark mode')}</span>
                </button>
              </div>
            </div>
          </div>
          <div className="grid gap-2 border-t border-border bg-secondary/30 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={() => { setOpen(false); setCartDrawerOpen(true); }} className="flex min-h-12 items-center justify-between rounded-xl border border-border bg-card px-3 text-start text-sm transition-colors hover:bg-secondary"><span className="flex items-center gap-3"><ShoppingBag size={17}/>{t('Your cart')}</span><span className="grid min-h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{cartCount}</span></button>
            {user ? <button type="button" onClick={() => void signOut({ redirectUrl: window.location.origin + '/sign-in' })} className="min-h-12 rounded-xl px-3 text-start text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">{t('Sign out')}</button> : <Link onClick={() => setOpen(false)} href="/sign-in" className="flex min-h-12 items-center rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">{t('Sign in')}</Link>}
          </div>
        </SheetContent>
      </Sheet>
    </header>

    <button
      type="button"
      onClick={() => setCartDrawerOpen(true)}
      aria-label={`${t('Cart')}, ${cartCount}`}
      title={t("Your cart")}
      className={`fixed bottom-5 end-5 z-40 inline-flex h-14 items-center gap-2.5 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-2xl hover:scale-105 transition active:scale-95 ${open || currentLocation === '/book' ? 'hidden' : ''}`}
      data-testid="link-floating-cart"
    >
      <ShoppingBag size={20}/>
      <span>{t("Cart")}</span>
      <span className="grid min-h-6 min-w-6 place-items-center rounded-full bg-background px-1.5 text-xs font-bold text-primary">
        {cartCount}
      </span>
    </button>

    <CartDrawer open={cartDrawerOpen} onClose={() => setCartDrawerOpen(false)} />

    {children}
    <footer className="border-t border-border bg-background px-5 py-12 text-foreground md:px-10 md:py-16">
      <div className="mx-auto grid max-w-[1280px] gap-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_.8fr_1fr] lg:gap-16">
        <section aria-labelledby="footer-brand-title">
          <div className="flex items-center gap-3"><BrandMark className="h-10 w-10 rounded-xl"/><h2 id="footer-brand-title" className="serif text-2xl">Complexe Rouis</h2></div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">{t('Beauty, hair & wellness in M\'saken.')}</p>
          <p className="mt-5 text-xs text-muted-foreground">{t('Daily')} <span aria-hidden="true">·</span> 9:00–19:00</p>
        </section>
        <nav aria-labelledby="footer-nav-title">
          <h2 id="footer-nav-title" className="text-xs font-semibold">{t('Explore')}</h2>
          <ul className="mt-4 space-y-2 text-sm"><li><Link href="/services" className="text-muted-foreground hover:text-foreground">{t('Treatments')}</Link></li><li><Link href="/book" className="text-muted-foreground hover:text-foreground">{t('Book an appointment')}</Link></li><li><Link href="/policies" className="text-muted-foreground hover:text-foreground">{t('Visit information')}</Link></li><li><Link href="/privacy" className="text-muted-foreground hover:text-foreground">{t('Privacy')}</Link></li><li><button type="button" onClick={()=>{setCookieChoice(null);setShowCookieDetails(true)}} className="min-h-11 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{t('Cookie settings')}</button></li><li><Link href="/admin/audit-logs" className="text-muted-foreground hover:text-foreground">{t('Owner access')}</Link></li></ul>
        </nav>
        <section aria-labelledby="footer-contact-title">
          <h2 id="footer-contact-title" className="text-xs font-semibold">{t('Find us')}</h2>
          <address className="mt-4 not-italic text-sm leading-6 text-muted-foreground">Av. de l'environnement<br/>M'saken, Tunisie · PHQM+H3</address>
          <a href="tel:+21655884366" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-foreground underline-offset-4 hover:underline">+216 55 884 366</a>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1"><FooterExternalLink href="https://maps.app.goo.gl/oKXfYfFcUZnzmea78">{t('Directions')}</FooterExternalLink><FooterExternalLink href="https://www.instagram.com/complex_rouis_de_beaute/?hl=en">Instagram</FooterExternalLink><FooterExternalLink href="https://www.facebook.com/p/complexe-rouis-desth%C3%A9tique-100089517565059/">Facebook</FooterExternalLink></div>
        </section>
      </div>
      <div className="mx-auto mt-10 flex max-w-[1280px] flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground"><span>© Complexe Rouis d'esthétique</span><HealthPip/></div>
    </footer>    {cookieChoice === null && <section aria-label={t('Cookie consent')} aria-live="polite" className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-3xl rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl sm:inset-x-6 sm:bottom-6 sm:p-6" data-testid="cookie-consent-banner"><div className="flex items-start gap-3"><span className="mt-0.5 rounded-full bg-secondary p-2 text-primary"><ShieldCheck size={18}/></span><div className="min-w-0 flex-1"><h2 className="serif text-2xl">{t('Your privacy matters')}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t('We use essential cookies and browser storage for sign-in, your cart, language, and booking flow. We do not currently use analytics or advertising cookies.')}</p>{showCookieDetails&&<div className="mt-3 rounded-xl bg-secondary/70 p-3 text-xs leading-5 text-muted-foreground"><p><strong className="text-foreground">{t('Essential storage')}</strong> — {t('Required for sign-in, cart, language, and booking features; always active.')}</p><p className="mt-2"><strong className="text-foreground">{t('Optional tracking')}</strong> — {t('No analytics or advertising trackers are currently enabled.')}</p><Link href="/privacy" className="mt-2 inline-block underline">{t('Read our privacy information')}</Link></div>}<div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" onClick={()=>saveCookieChoice('accepted')} className="rounded-full bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground">{t('Accept all')}</button><button type="button" onClick={()=>saveCookieChoice('rejected')} className="rounded-full border border-border px-4 py-2.5 text-xs font-medium hover:bg-secondary">{t('Reject optional')}</button><button type="button" onClick={()=>setShowCookieDetails(value=>!value)} className="rounded-full px-3 py-2.5 text-xs text-muted-foreground underline underline-offset-2">{showCookieDetails?t('Hide details'):t('Cookie details')}</button></div></div></div></section>}
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
  const [added, setAdded] = useState(false);

  const handleAddToCart = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    addToCartHelper(service.id);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  };

  return (
    <article className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-primary/40 hover:shadow-md" data-testid={`card-service-${service.id}`}>
      <Link href={`/services/${service.slug || service.id}`} aria-label={`${service.name} - ${t('See details')}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          {service.imageUrl ? (
            <img src={service.imageUrl} alt={service.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" />
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <Flower2 className="text-primary/45" size={64} strokeWidth={0.8} aria-hidden="true" />
            </div>
          )}
          <span className="absolute start-4 top-4 rounded-full bg-background/90 px-3 py-1.5 text-xs text-foreground">
            {service.category}
          </span>
          {service.isFeatured && (
            <span className="absolute end-4 top-4 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground">
              {t('FEATURED')}
            </span>
          )}
        </div>
        <div className="p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="serif text-[22px] leading-tight transition-colors duration-200 group-hover:text-primary">{service.name}</h3>
            <ArrowUpRight size={18} aria-hidden="true" className="mt-1 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          {service.shortDescription && (
            <p className="mt-2 text-sm leading-6 text-muted-foreground line-clamp-2">{service.shortDescription}</p>
          )}
        </div>
      </Link>
      <div className="px-5 pb-5 pt-0">
        <div className="flex items-end justify-between gap-3 border-t border-border pt-4">
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{formatMoney(service.priceAmount, service.currency)}</span>
            {service.discountPercent > 0 && <span className="text-xs"><del className="me-1 text-muted-foreground">{formatMoney(service.originalPriceAmount, service.currency)}</del><span className="font-semibold text-destructive">-{service.discountPercent}%</span></span>}
            <span className="mt-1 text-xs text-muted-foreground">{service.durationMinutes} min</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleAddToCart} aria-label={added ? t('Added to cart') : t('Add to cart')} className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${added ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-border text-foreground hover:border-primary hover:text-primary'}`}>
              {added ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
              <span className="hidden sm:inline">{added ? t('Added') : t('Add')}</span>
            </button>
            <button type="button" onClick={() => setLocation(`/book?service=${service.id}`)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              {t('Book')} <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
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
    <section aria-labelledby="home-hero-title" className="mx-auto max-w-[1360px] px-5 py-10 md:px-10 md:py-14">
      <div className="grid items-center gap-8 lg:grid-cols-[.82fr_1.18fr] lg:gap-14">
        <div className="max-w-xl py-4 lg:py-12">
          <p className="text-xs font-medium uppercase tracking-[.18em] text-primary">{t('COMPLEXE ROUIS · BEAUTY & WELLNESS')} · M&apos;saken</p>
          <h1 id="home-hero-title" className="serif mt-5 text-5xl leading-[1.04] sm:text-6xl md:text-7xl">{t('Beauty, care,')}<br/><em>{t('close to you.')}</em></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">{t('A bright space, a caring team, and beauty, hair, and wellness treatments. Explore the menu and choose what feels right for you.')}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/book" className="inline-flex min-h-12 items-center gap-3 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" data-testid="link-hero-book">{t('Book an appointment')} <ArrowRight size={16} aria-hidden="true"/></Link><Link href="/services" className="inline-flex min-h-12 items-center px-3 text-sm text-foreground underline decoration-border underline-offset-4 transition-colors duration-200 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" data-testid="link-explore-services">{t('Explore services')}</Link></div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-5 text-sm text-muted-foreground"><span>{t('Av. de l’environnement, M’saken')}</span><span>{t('Every day')} · 9:00–19:00</span></div>
        </div>
        <div className="relative grid min-h-[370px] grid-cols-[1.1fr_.9fr] gap-3 sm:min-h-[500px] sm:gap-4">
          <figure className="relative min-h-[370px] overflow-hidden rounded-xl bg-secondary sm:min-h-[500px]"><img src="/complexe-rouis-stairs.jpg" alt={t('Stone staircase and glass railing in the bright Complexe Rouis interior')} width="911" height="2048" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover object-center"/><figcaption className="absolute bottom-3 start-3 bg-background/90 px-3 py-2 text-[11px] text-foreground">Complexe Rouis · M&apos;saken</figcaption></figure>
          <figure className="relative mb-10 mt-10 min-h-[320px] overflow-hidden rounded-xl bg-secondary sm:mb-14 sm:mt-14 sm:min-h-[430px]"><img src="/complexe-rouis-chandelier.jpg" alt={t('Golden chandelier in the Complexe Rouis reception area')} width="923" height="2048" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-center"/><figcaption className="absolute bottom-3 start-3 bg-background/90 px-3 py-2 text-[11px] text-foreground">{t('Beauty & wellness')}</figcaption></figure>
        </div>
      </div>
    </section>
    <section aria-labelledby="featured-treatments-title" className="mx-auto max-w-[1320px] px-5 py-20 md:px-10 md:py-28">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="mono text-[10px] tracking-[.2em] text-primary">{t('A GOOD PLACE TO BEGIN')}</p><h2 id="featured-treatments-title" className="serif mt-3 text-5xl md:text-6xl">{t('Time that feels like yours.')}</h2></div><Link href="/services" className="text-sm underline decoration-border underline-offset-4 hover:decoration-primary">{t('See every treatment')} <ArrowRight className="ms-2 inline" size={14}/></Link></div>
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {services.isLoading ? (
          <LoadingBlock label="Loading treatments" />
        ) : services.isError ? (
          <ErrorBlock retry={() => void services.refetch()} />
        ) : (
          (Array.isArray(services.data) ? services.data.filter(s => s.isFeatured).slice(0, 6) : []).map(s => (
            <DynamicServiceCard key={s.id} service={s} />
          ))
        )}
        {!services.isLoading && !services.isError && Array.isArray(services.data) && services.data.length === 0 && <p className="text-sm text-muted-foreground">{t('The menu is taking shape.')}</p>}
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
  const [showCategoryCue, setShowCategoryCue] = useState(true);
  const [hasScrolledCategories, setHasScrolledCategories] = useState(false);
  const categoryStripRef = useRef<HTMLDivElement>(null);

  const updateCategoryCue = () => {
    const strip = categoryStripRef.current;
    if (!strip) return;
    const canScroll = strip.scrollWidth > strip.clientWidth + 2;
    const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4;
    setShowCategoryCue(canScroll && !atEnd);
    setHasScrolledCategories(strip.scrollLeft > 2);
  };

  const scrollCategoriesForward = () => {
    const strip = categoryStripRef.current;
    if (!strip) return;
    strip.scrollBy({ left: strip.clientWidth * 0.75, behavior: 'smooth' });
  };

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
        <div className="relative mt-10">
          <div ref={categoryStripRef} onScroll={updateCategoryCue} onKeyUp={updateCategoryCue} className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-3 pb-3 pe-12 scrollbar-hide" role="group" aria-label={t('Filter treatments by category')}>
          {allCategories.map(c => (
            <button
              key={c}
              type="button"
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
              className={`min-h-11 shrink-0 snap-start rounded-full border px-5 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                filter === c ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/60'
              }`}
              data-testid={`filter-${c.toLowerCase().replaceAll(' ', '-').replaceAll('&', '-')}`}
            >
              {c === 'Tout' ? t('All') : t(c)}
            </button>
          ))}
          </div>
          <div className={`absolute inset-y-0 end-0 z-10 flex w-14 items-center justify-center bg-gradient-to-l from-background via-background/80 to-transparent transition-opacity duration-200 ${showCategoryCue ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
            <button type="button" onClick={scrollCategoriesForward} aria-label={t('Scroll to more treatment categories')} className="inline-flex min-h-11 min-w-11 items-center justify-center text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <ArrowRight size={18} aria-hidden="true" className="animate-[category-nudge_1.4s_ease-in-out_infinite] motion-reduce:animate-none" />
            </button>
          </div>
          <div className={`flex items-center justify-end gap-2 pt-1 text-xs text-muted-foreground transition-opacity duration-200 sm:hidden ${showCategoryCue ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true">
            <span>{t('Scroll to explore')}</span>
          </div>
        </div>
        {services.isLoading ? (
          <LoadingBlock label="Loading treatments" />
        ) : services.isError ? (
          <ErrorBlock retry={() => void services.refetch()} />
        ) : items.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
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
      <Meta title={s?.name || 'Treatment details'} description={s?.shortDescription || 'Treatment information and booking details.'} noindex={!s} />
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
                <img src={s.imageUrl} alt={s.name} decoding="async" fetchPriority="high" className="h-full w-full object-cover" />
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
              <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    addToCartHelper(s.id);
                  }}
                  className="inline-flex w-full sm:w-auto flex-1 items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/5 hover:bg-primary/15 px-6 py-4 text-sm font-medium text-primary transition"
                >
                  <ShoppingBag size={17} />
                  <span>{t("Add to cart")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLocation(`/book?service=${s.id}`)}
                  className="inline-flex w-full sm:w-auto flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground shadow-md hover:opacity-95 transition"
                >
                  <span>{t("Book now")}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
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
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const services = useListServices();
  const profile = useGetSpaProfile();
  const params = new URLSearchParams(window.location.search);
  const initialServiceId = params.get('service') || '';
  const [serviceToAdd, setServiceToAdd] = useState('');
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const servicePickerRef = useRef<HTMLDivElement>(null);
  const [cartServiceIds, setCartServiceIds] = useState<string[]>(() => {
    const storedCart = readStoredCart();
    return initialServiceId
      ? [initialServiceId, ...storedCart.filter(id => id !== initialServiceId)].slice(0, 8)
      : storedCart;
  });
  const [date, setDate] = useState(dateLocal(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
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
  const calendarLocale = language === 'ar' ? 'ar' : language === 'fr' ? 'fr-FR' : 'en-US';
  const calendarDays = useMemo(() => {
    const firstWeekday = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    return [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  }, [calendarMonth]);
  const selectedDate = date ? new Date(`${date}T12:00:00`) : null;
  const todayDate = dateLocal(new Date());
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const canGoToPreviousMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1) > new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  useEffect(() => { saveStoredCart(cartServiceIds); }, [cartServiceIds]);

  useEffect(() => {
    if (!servicePickerOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!servicePickerRef.current?.contains(event.target as Node)) setServicePickerOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setServicePickerOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [servicePickerOpen]);

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
        <section><StepLabel n="01" text="Choose a treatment"/><div className="mt-4 flex flex-col gap-3 sm:flex-row"><div ref={servicePickerRef} className="relative min-w-0 flex-1"><button type="button" aria-haspopup="listbox" aria-expanded={servicePickerOpen} aria-controls="booking-service-options" onClick={()=>setServicePickerOpen(open=>!open)} disabled={services.isLoading||!services.data?.length} className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-input bg-background px-4 py-3.5 text-start text-sm transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60" data-testid="select-booking-service"><span className={serviceToAdd?'truncate text-foreground':'truncate text-muted-foreground'}>{services.data?.find(service=>service.id===serviceToAdd)?.name||t('Select a treatment')}</span><ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${servicePickerOpen?'rotate-180':''}`}/></button>{servicePickerOpen&&<div id="booking-service-options" role="listbox" aria-label={t('Select a treatment')} className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 max-h-[min(52dvh,24rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-2 shadow-xl ring-1 ring-foreground/5">{services.data?.map(service=><button type="button" key={service.id} role="option" aria-selected={service.id===serviceToAdd} onClick={()=>{setServiceToAdd(service.id);setServicePickerOpen(false)}} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-start transition hover:bg-secondary ${service.id===serviceToAdd?'bg-secondary':''}`}><span className="min-w-0"><span className="block break-words text-sm font-medium">{service.name}</span><span className="mt-1 block text-xs text-muted-foreground">{service.durationMinutes} min</span></span><span className="shrink-0 text-sm tabular-nums">{service.discountPercent>0&&<><del className="me-1 text-xs text-muted-foreground">{formatMoney(service.originalPriceAmount,service.currency)}</del><span className="me-1 text-xs text-destructive">-{service.discountPercent}%</span></>}{formatMoney(service.priceAmount,service.currency)}</span></button>)}</div>}</div><button type="button" onClick={addToCart} disabled={!serviceToAdd || cartServiceIds.length >= 8} className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm disabled:opacity-50"><Plus size={15}/>{t('Add to cart')}</button></div>{services.isLoading&&<p className="mt-2 text-xs text-muted-foreground">{t('Loading treatments')}</p>}{services.isError&&<button type="button" onClick={()=>void services.refetch()} className="mt-2 text-xs underline">{t('Retry loading treatments')}</button>}
          <div className="mt-5 rounded-2xl border border-border p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-medium">{t('Your cart')}</h3><span className="text-xs text-muted-foreground">{cartServices.length}/8</span></div>{cartServices.length?<ul className="mt-3 max-h-[32dvh] divide-y divide-border overflow-y-auto overscroll-contain pe-1">{cartServices.map((service,index)=><li key={service.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm">{index+1}. {service.name}</p><p className="mt-1 text-xs text-muted-foreground">{service.durationMinutes} min | {service.discountPercent>0&&<><del className="me-1">{formatMoney(service.originalPriceAmount,service.currency)}</del><span className="me-1 text-destructive">-{service.discountPercent}%</span></>}{formatMoney(service.priceAmount,service.currency)}</p></div><button type="button" onClick={()=>removeFromCart(service.id)} aria-label={`${t('Remove')} ${service.name}`} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs">{t('Remove')}</button></li>)}</ul>:<p className="mt-3 text-sm text-muted-foreground">{t('Your cart is empty. Add one or more treatments to continue.')}</p>}</div>
        </section>
        <section><StepLabel n="02" text="Pick a day & time"/><div className="mx-auto mt-4 w-full max-w-[390px] rounded-2xl border border-border bg-background p-4 sm:p-5" data-testid="booking-calendar"><div className="mb-4 flex items-center justify-between gap-3"><button type="button" aria-label={t('Previous month')} disabled={!canGoToPreviousMonth} onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1))} className="rounded-full border border-border p-2 transition hover:bg-secondary disabled:opacity-35" data-testid="calendar-previous"><ChevronLeft size={16}/></button><h3 className="text-sm font-medium">{monthStart.toLocaleDateString(calendarLocale,{month:'long',year:'numeric'})}</h3><button type="button" aria-label={t('Next month')} onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1))} className="rounded-full border border-border p-2 transition hover:bg-secondary" data-testid="calendar-next"><ChevronRight size={16}/></button></div><div className="grid grid-cols-7 gap-1 text-center">{Array.from({length:7},(_,index)=>{const weekday=new Date(2024,0,7+index).toLocaleDateString(calendarLocale,{weekday:'short'});return <span key={index} className="pb-1 text-[10px] font-medium text-muted-foreground">{weekday}</span>})}{calendarDays.map((day,index)=>{if(day===null)return <span key={`empty-${index}`}/>;const value=dateLocal(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),day));const isPast=value<todayDate;const isSelected=value===date;return <button type="button" key={value} disabled={isPast} aria-pressed={isSelected} aria-label={new Date(`${value}T12:00:00`).toLocaleDateString(calendarLocale,{dateStyle:'full'})} onClick={()=>{setDate(value);setSlot('')}} className={`grid aspect-square place-items-center rounded-full text-xs transition ${isSelected?'bg-primary font-semibold text-primary-foreground':isPast?'cursor-not-allowed text-muted-foreground/40':'hover:bg-secondary'}`} data-testid={`calendar-day-${value}`}>{day}</button>})}</div><p className="mt-3 text-center text-xs text-muted-foreground">{selectedDate?.toLocaleDateString(calendarLocale,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</p></div>{cartServiceIds.length>0&&<div className="mt-4">{cartQuery.isLoading?<div className="flex flex-wrap justify-center gap-2">{[1,2,3,4].map(i=><span key={i} className="h-10 w-20 animate-pulse rounded-full bg-secondary"/>)}</div>:cartQuery.isError?<div className="rounded-xl bg-secondary p-4 text-sm">{t('Availability could not be loaded.')} <button type="button" onClick={()=>void cartQuery.refetch()} className="underline">{t('Try again')}</button></div>:cartQuery.data?.length?<div className="flex flex-wrap justify-center gap-2">{cartQuery.data.map(item=><button type="button" key={item.startsAt} onClick={()=>setSlot(item.startsAt)} className={`rounded-full border px-4 py-2.5 text-xs transition ${slot===item.startsAt?'border-primary bg-primary text-primary-foreground':'border-border hover:bg-secondary'}`} data-testid={`slot-${item.startsAt}`}>{item.label}</button>)}</div>:<div className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">{t('No available times for this cart on this date. Choose another day.')}</div>}</div>}</section>
        <section><StepLabel n="03" text="Your details"/><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-xs">{t('Full name')}<input required minLength={2} maxLength={120} value={name} onChange={event=>setName(event.target.value)} autoComplete="name" className="rounded-xl border border-input bg-background px-4 py-3 text-sm" data-testid="input-booking-name"/></label><label className="grid gap-2 text-xs">{t('Email address')}<input required type="email" maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" className="rounded-xl border border-input bg-background px-4 py-3 text-sm" data-testid="input-booking-email"/></label><label className="grid gap-2 text-xs">{t('Phone number')}<input required type="tel" minLength={7} maxLength={40} value={phone} onChange={event=>setPhone(event.target.value)} autoComplete="tel" className="rounded-xl border border-input bg-background px-4 py-3 text-sm" data-testid="input-booking-phone"/></label><label className="grid gap-2 text-xs">{t('A note for our team')} <span className="text-muted-foreground">{t('(optional)')}</span><input maxLength={1000} value={note} onChange={event=>setNote(event.target.value)} className="rounded-xl border border-input bg-background px-4 py-3 text-sm" data-testid="input-booking-note"/></label></div></section>
        <section className="rounded-xl bg-secondary/70 p-4"><label className="flex cursor-pointer items-start gap-3 text-xs leading-5"><input type="checkbox" checked={accepted} onChange={event=>setAccepted(event.target.checked)} className="mt-1 accent-primary" data-testid="checkbox-policy-accept"/><span>{t('I have read and accept the')} <Link className="underline" href="/policies">{t('visit and cancellation policy')}</Link>. {t('Current policy details are demo/setup placeholders.')}</span></label></section>
        {formError&&<p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert" data-testid="status-booking-error">{formError}</p>}
        <button disabled={submitting||cartServices.length===0} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground disabled:opacity-60" data-testid="button-submit-booking">{submitting?<><LoaderCircle className="animate-spin" size={17}/>{t('Checking and booking…')}</>:<>{t('Reserve cart')} <ArrowRight size={16}/></>}</button>
      </form>
      <aside className="h-fit max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-[1.5rem] bg-secondary p-5 sm:p-6 lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)]"><p className="mono text-[9px] tracking-[.2em] text-primary">{t('YOUR VISIT')}</p><h2 className="serif mt-3 text-3xl">{t('Reservation summary')}</h2>{cartServices.length?<div className="mt-5 border-t border-primary/15 pt-4 text-sm"><ul className="max-h-[24dvh] space-y-3 overflow-y-auto overscroll-contain">{cartServices.map(service=><li key={service.id} className="flex justify-between gap-3"><span className="min-w-0 break-words">{service.name}</span><span className="shrink-0 whitespace-nowrap">{service.discountPercent>0&&<><del className="me-1 text-muted-foreground">{formatMoney(service.originalPriceAmount,service.currency)}</del><span className="me-1 text-destructive">-{service.discountPercent}%</span></>}{formatMoney(service.priceAmount,service.currency)}</span></li>)}</ul><div className="mt-4 flex justify-between border-t border-primary/15 pt-4"><span className="text-muted-foreground">{t('Treatment time')}</span><span>{totalServiceDuration} min</span></div><div className="flex justify-between py-2 font-medium"><span>{t('Total')}</span><span>{formatMoney(totalPrice,currency)}</span></div><div className="flex justify-between py-2"><span className="text-muted-foreground">{t('Date')}</span><span>{date?new Date(`${date}T12:00:00`).toLocaleDateString(getIntlLocale(language),{month:'short',day:'numeric'}):t('Choose a date')}</span></div><div className="flex justify-between py-2"><span className="text-muted-foreground">{t('Time')}</span><span>{cartQuery.data?.find(item=>item.startsAt===slot)?.label||t('Choose a time')}</span></div></div>:<p className="mt-2 text-sm leading-6 text-muted-foreground">{t('Your cart is empty. Add one or more treatments to continue.')}</p>}{cartServices.length > 1 && <p className="mt-2 text-xs text-muted-foreground">{t('Includes the required space between treatments.')}</p>}<div className="mt-6 border-t border-primary/15 pt-4"><div className="flex gap-3"><ShieldCheck className="shrink-0 text-primary" size={18}/><p className="text-xs leading-5 text-muted-foreground">{t('No account needed. Your request is checked against live availability when you confirm.')}</p></div><p className="mt-4 text-[10px] leading-4 text-muted-foreground">{profile.data?.cancellationPolicy||t('Cancellation policy is a demo/setup placeholder.')}</p></div></aside>
    </div></main></>;
}

export function AccountPage() {
  const { user } = useUser();
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<'profile' | 'history'>('profile');
  useEffect(() => {
    if (!user) return;
    void fetch('/api/auth/link-customer', { method: 'POST', credentials: 'include' }).catch(() => undefined);
  }, [user?.id]);
  const profile = readStoredCustomerProfile();
  const bookings = readStoredBookingHistory();
  const upcoming = bookings.filter(item => new Date(item.startsAt).getTime() >= Date.now()).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const previous = bookings.filter(item => new Date(item.startsAt).getTime() < Date.now()).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  return <><Meta title={t('Your account')} description={t('Your saved spa details and booking history.')} /><main className="page-enter mx-auto max-w-[1200px] px-5 py-12 md:px-10 md:py-16"><div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="mono text-[10px] tracking-[.2em] text-primary">{t('YOUR ACCOUNT')}</p><h1 className="serif mt-3 text-5xl md:text-6xl">{t('Welcome back')}{user?.firstName ? `, ${user.firstName}` : ''}.</h1></div><div className="flex gap-2 rounded-full border border-border bg-card p-1"><button type="button" onClick={() => setTab('profile')} className={`rounded-full px-4 py-2 text-xs ${tab === 'profile' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{t('Profile')}</button><button type="button" onClick={() => setTab('history')} className={`rounded-full px-4 py-2 text-xs ${tab === 'history' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{t('History')}</button></div></div>{tab === 'profile' ? <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]"><section className="rounded-[1.5rem] border border-border bg-card p-6"><h2 className="serif text-3xl">{t('Saved details')}</h2><div className="mt-5 space-y-4 text-sm"><div><p className="text-muted-foreground">{t('Name')}</p><p className="mt-1 font-medium">{profile.name || user?.fullName || t('Not saved yet')}</p></div><div><p className="text-muted-foreground">{t('Email')}</p><p className="mt-1 font-medium">{profile.email || user?.primaryEmailAddress?.emailAddress || t('Not saved yet')}</p></div><div><p className="text-muted-foreground">{t('Phone')}</p><p className="mt-1 font-medium">{profile.phone || user?.phoneNumbers?.[0]?.phoneNumber || t('Not saved yet')}</p></div></div></section><section className="rounded-[1.5rem] border border-border bg-card p-6"><h2 className="serif text-3xl">{t('Quick actions')}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><Link href="/book" className="rounded-2xl bg-secondary px-4 py-5 text-start hover:bg-secondary/80"><p className="mono text-[9px] tracking-[.16em] text-primary">{t('BOOK')}</p><p className="serif mt-2 text-2xl">{t('New visit')}</p></Link><Link href="/services" className="rounded-2xl bg-secondary px-4 py-5 text-start hover:bg-secondary/80"><p className="mono text-[9px] tracking-[.16em] text-primary">{t('EXPLORE')}</p><p className="serif mt-2 text-2xl">{t('Treatments')}</p></Link></div><p className="mt-6 text-sm leading-6 text-muted-foreground">{t('Your contact details are remembered automatically after you book, and they will be reused the next time you choose a treatment.')}</p></section></div> : <section className="rounded-[1.5rem] border border-border bg-card p-6"><h2 className="serif text-3xl">{t('Booking history')}</h2>{bookings.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t('No bookings yet. Your upcoming and past appointments will appear here once you book a visit.')}</div> : <div className="mt-6 grid gap-4">{[[t('UPCOMING'), upcoming],[t('PAST'), previous]].map(([label, items]) => <div key={String(label)}><h3 className="mono text-[9px] tracking-[.2em] text-primary">{String(label)}</h3>{(items as typeof bookings).length ? <div className="mt-3 space-y-3">{(items as typeof bookings).map(item => <div key={item.id} className="rounded-2xl border border-border bg-secondary/40 p-4"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="font-medium">{item.serviceName}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.startsAt).toLocaleString(getIntlLocale(language),{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-[.12em] text-primary">{t(item.status)}</span><span className="text-sm font-medium">{formatMoney(item.priceAmount, item.currency)}</span></div></div></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">{String(label) === t('UPCOMING') ? t('No upcoming appointments.') : t('No past appointments yet.')}</p>}</div>)}</div>}</section>}</main></>;
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
  const { language } = useLanguage();
  const [confirmation,setConfirmation]=useState<BookingConfirmation|null>(null);
  useEffect(()=>{try{const value=sessionStorage.getItem('stillroom-confirmation');if(value)setConfirmation(JSON.parse(value) as BookingConfirmation)}catch{setConfirmation(null)}},[]);
  return <><Meta title="Booking confirmed" description="Your appointment booking details."/><main className="page-enter mx-auto max-w-3xl px-5 py-16 md:py-24"><div className="rounded-[2rem] border border-border bg-card px-6 py-12 text-center md:px-14"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-primary"><Check size={28}/></div>{confirmation?<><p className="mono mt-6 text-[10px] tracking-[.2em] text-primary">BOOKING {confirmation.status.toUpperCase()}</p><h1 className="serif mt-3 text-5xl md:text-6xl">Your pause is on the calendar.</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Your booking details are below. A confirmation has been created using the live schedule.</p><div className="mx-auto mt-9 max-w-md rounded-2xl bg-secondary/70 p-5 text-start"><div className="flex justify-between border-b border-border py-3"><span className="text-sm text-muted-foreground">Reference</span><span className="mono text-sm">{confirmation.bookingReference}</span></div><div className="flex justify-between border-b border-border py-3"><span className="text-sm text-muted-foreground">Treatment</span><span className="text-sm">{confirmation.serviceName}</span></div><div className="flex justify-between border-b border-border py-3"><span className="text-sm text-muted-foreground">Date & time</span><span className="text-right text-sm">{new Date(confirmation.startsAt).toLocaleString(getIntlLocale(language),{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span></div><div className="flex justify-between py-3"><span className="text-sm text-muted-foreground">Price</span><span className="text-sm">{formatMoney(confirmation.priceAmount,confirmation.currency)}</span></div></div><p className="mt-5 text-xs text-muted-foreground">Keep your reference for your records. The confirmation is saved only in this browser for reload support.</p></>:<><p className="mono mt-6 text-[10px] tracking-[.2em] text-primary">NO SAVED CONFIRMATION</p><h1 className="serif mt-3 text-5xl">Ready when you are.</h1><p className="mt-4 text-sm text-muted-foreground">We couldn't find a confirmation in this browser. Start a new booking to reserve a time.</p></>}<Link href="/book" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-4 text-sm text-primary-foreground">Book another visit <ArrowRight size={15}/></Link></div></main></>;
}

export function PoliciesPage({privacy=false}:{privacy?:boolean}) {
  const { language, t } = useLanguage();
  const profile=useGetSpaProfile();
  if (!privacy) {
    const weekdayFormatter = new Intl.DateTimeFormat(getIntlLocale(language), { weekday: 'long', timeZone: 'UTC' });
    const days = Array.from({ length: 7 }, (_, index) => weekdayFormatter.format(new Date(Date.UTC(2024, 0, 7 + index))));
    const address = "Av. de l'environnement, M'saken, Tunisie";
    const mapUrl = 'https://maps.app.goo.gl/oKXfYfFcUZnzmea78';
    return <><Meta title={t('Plan your visit')} description={t('Find us in M\'saken, open every day from 9:00 AM to 7:00 PM.')} noindex/><main className="page-enter mx-auto max-w-[1100px] px-5 py-14 md:px-10 md:py-20"><IntroTitle eyebrow={t('BEFORE YOU ARRIVE')} title={t('The details that make a visit easy.')} text={t('Find us in M\'saken, open every day from 9:00 AM to 7:00 PM.')}/><div className="mt-10 grid gap-6 md:grid-cols-2"><InfoPanel title={t('Location & contact')}><address className="not-italic">{address}<br/><span>PHQM+H3, M&apos;saken</span></address><a href="tel:+21655884366" dir="ltr" className="mt-5 flex min-h-11 w-fit items-center gap-3 text-base font-medium text-foreground underline underline-offset-4 hover:text-primary"><Phone size={18} aria-hidden="true"/><span>+216 55 884 366</span></a><a href={mapUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex min-h-11 w-fit items-center gap-3 text-sm text-primary underline underline-offset-4"><SiGooglemaps size={19} aria-hidden="true"/><span>{t('Open in Google Maps')}</span><ArrowUpRight size={15} aria-hidden="true"/></a><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4"><a href="https://www.instagram.com/complex_rouis_de_beaute/?hl=en" target="_blank" rel="noopener noreferrer" aria-label={t('Follow on Instagram')} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"><SiInstagram size={18} aria-hidden="true"/><span>Instagram</span></a><a href="https://www.facebook.com/p/complexe-rouis-desth%C3%A9tique-100089517565059/" target="_blank" rel="noopener noreferrer" aria-label={t('Follow on Facebook')} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"><SiFacebook size={18} aria-hidden="true"/><span>Facebook</span></a></div></InfoPanel><InfoPanel title={t('Opening hours')}><div className="divide-y divide-border">{days.map((day,index)=><div key={index} className="flex items-center justify-between gap-4 py-2.5 text-sm"><span className="text-foreground">{day}</span><span className="text-muted-foreground" dir="ltr">9:00–19:00</span></div>)}</div><p className="mt-4 text-xs text-muted-foreground">{t('Hours may vary on public holidays.')}</p></InfoPanel></div><figure className="group relative mt-7 overflow-hidden rounded-2xl border border-border bg-secondary"><img src="/complexe-rouis-salon.jpg" alt={t('A bright, welcoming salon interior at Complexe Rouis')} width="2048" height="1024" loading="lazy" decoding="async" className="aspect-[2/1] max-h-[360px] w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.01] motion-reduce:transition-none"/><figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-4 pt-12 text-xs text-white sm:px-6 sm:pb-5 sm:text-sm">{t('Inside Complexe Rouis')}</figcaption></figure></main></>;
  }
  const heading=privacy?'Privacy':'Plan your visit';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const address = "Av. de l'environnement, M'saken, Tunisie";
  const mapUrl = 'https://maps.app.goo.gl/oKXfYfFcUZnzmea78';
  return <><Meta title={heading} description={privacy?'Privacy information for Complexe Rouis.':'Opening hours, address, and contact details for Complexe Rouis in M\'saken.'} noindex/><main className="page-enter mx-auto max-w-[1100px] px-5 py-14 md:px-10 md:py-20"><IntroTitle eyebrow={privacy?'YOUR INFORMATION':'BEFORE YOU ARRIVE'} title={privacy?'Privacy, plainly.':'The details that make a visit easy.'} text={privacy?'This is a privacy information template for the spa platform. Business-specific practices have not yet been supplied.':'Find us in M\'saken, open every day from 9:00 AM to 7:00 PM.'}/>{privacy ? <><div className="mt-8 grid gap-5 md:grid-cols-2"><InfoPanel title="Information you provide"><p>Booking details submitted through this site are used to create and manage an appointment. The exact collection, storage, retention, and sharing practices must be confirmed by the business.</p></InfoPanel><InfoPanel title="Cookies & service providers"><p>The platform may use essential browser storage for booking confirmation support and authentication. Confirm analytics, cookie, and service-provider disclosures with the business.</p></InfoPanel><InfoPanel title="Your choices"><p>Contact the business using the contact details on the visit information page to ask about access, correction, deletion, or privacy concerns.</p></InfoPanel><InfoPanel title="Policy updates"><p>This information can be revised when approved privacy practices are available.</p></InfoPanel></div></> : <div className="mt-10 grid gap-6 md:grid-cols-[1fr_1fr]"><InfoPanel title="Find us"><address className="not-italic">{address}<br/><span>PHQM+H3, M&apos;saken</span></address><a href="tel:+21655884366" className="mt-5 flex min-h-11 w-fit items-center gap-3 text-base font-medium text-foreground underline underline-offset-4 hover:text-primary"><Phone size={18} aria-hidden="true"/><span>+216 55 884 366</span></a><a href={mapUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex min-h-11 w-fit items-center gap-3 text-sm text-primary underline underline-offset-4"><SiGooglemaps size={19} aria-hidden="true"/><span>Open in Google Maps</span><ArrowUpRight size={15} aria-hidden="true"/></a><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4"><a href="https://www.instagram.com/complex_rouis_de_beaute/?hl=en" target="_blank" rel="noopener noreferrer" aria-label="Complexe Rouis on Instagram" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"><SiInstagram size={18} aria-hidden="true"/><span>Instagram</span></a><a href="https://www.facebook.com/p/complexe-rouis-desth%C3%A9tique-100089517565059/" target="_blank" rel="noopener noreferrer" aria-label="Complexe Rouis on Facebook" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"><SiFacebook size={18} aria-hidden="true"/><span>Facebook</span></a></div></InfoPanel><InfoPanel title="Opening hours"><div className="divide-y divide-border">{days.map(day=><div key={day} className="flex items-center justify-between gap-4 py-2.5 text-sm"><span className="text-foreground">{day}</span><span className="text-muted-foreground">9:00 AM – 7:00 PM</span></div>)}</div><p className="mt-4 text-xs text-muted-foreground">Hours may vary on public holidays.</p></InfoPanel></div>}</main></>;
}
function InfoPanel({title,children}:{title:string;children:ReactNode}) { return <section className="rounded-2xl border border-border bg-card p-6 md:p-7"><h2 className="serif text-3xl">{title}</h2><div className="mt-4 text-sm leading-6 text-muted-foreground">{children}</div></section> }

const BOOKING_DISCOUNTS_KEY = 'stillroom-booking-discounts';
const BOOKING_EXTRA_ITEMS_KEY = 'stillroom-booking-extra-items';

function readStoredDiscounts(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(BOOKING_DISCOUNTS_KEY) || '{}');
  } catch { return {}; }
}
function saveStoredDiscounts(map: Record<string, number>) {
  try { localStorage.setItem(BOOKING_DISCOUNTS_KEY, JSON.stringify(map)); } catch { }
}

function readStoredExtraItems(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(BOOKING_EXTRA_ITEMS_KEY) || '{}');
  } catch { return {}; }
}
function saveStoredExtraItems(map: Record<string, string[]>) {
  try { localStorage.setItem(BOOKING_EXTRA_ITEMS_KEY, JSON.stringify(map)); } catch { }
}

function extractBookingServices(
  rawServiceName: string,
  availableServices: { name: string; priceAmount: number }[]
): { names: string[]; totalPrice: number } {
  if (!rawServiceName) return { names: [], totalPrice: 0 };

  // Sort available services by name length descending so composite names like
  // "Capsule + Gel + Vernis" match before individual names like "Vernis" or "Gel"
  const sorted = [...availableServices].sort((a, b) => b.name.length - a.name.length);

  let remaining = rawServiceName;
  const matchedNames: string[] = [];
  let totalPrice = 0;

  for (const s of sorted) {
    if (!s.name) continue;
    const escaped = s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s*\\+\\s*|\\s*,\\s*)${escaped}(\\s*\\+\\s*|\\s*,\\s*|$)`, 'i');
    if (regex.test(remaining)) {
      matchedNames.push(s.name);
      totalPrice += s.priceAmount;
      remaining = remaining.replace(regex, '$1$2').trim();
    }
  }

  // Check any remaining pieces separated by '+' or ','
  const remainingParts = remaining.split(/\s*[\+,]\s*/).map((p) => p.trim()).filter(Boolean);
  for (const part of remainingParts) {
    const found = availableServices.find((s) => s.name.toLowerCase() === part.toLowerCase());
    if (found) {
      if (!matchedNames.includes(found.name)) {
        matchedNames.push(found.name);
        totalPrice += found.priceAmount;
      }
    } else if (part.length > 1) {
      matchedNames.push(part);
    }
  }

  if (matchedNames.length === 0) {
    matchedNames.push(rawServiceName);
  }

  return { names: matchedNames, totalPrice };
}

function DashboardInner() {
  const { t, language } = useLanguage();
  const dashboard = useGetManagerDashboard();
  const [bookingDate, setBookingDate] = useState(() => dateLocal(new Date()));
  const bookings = useListManagerBookings({ date: bookingDate });
  const allServicesQuery = useListServices();
  const staff = useListManagerStaff();
  const qc = useQueryClient();
  const update = useUpdateBookingStatus();
  const assign = useAssignBookingStaff();

  const [phoneSearch, setPhoneSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [discounts, setDiscounts] = useState<Record<string, number>>(() => readStoredDiscounts());
  const [extraItems, setExtraItems] = useState<Record<string, string[]>>(() => readStoredExtraItems());
  const [editingCartBooking, setEditingCartBooking] = useState<ManagerBooking | null>(null);
  const [serviceToAdd, setServiceToAdd] = useState<string>('');
  const [customDiscountBookingId, setCustomDiscountBookingId] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [assignmentError, setAssignmentError] = useState('');

  const allAvailableServices = useMemo(() => {
    if (Array.isArray(allServicesQuery.data) && allServicesQuery.data.length > 0) {
      return allServicesQuery.data;
    }
    return ROUIS_SERVICES.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      priceAmount: s.price * 100,
      currency: 'TND',
      durationMinutes: 45,
      shortDescription: s.note || '',
      discountPercent: 0,
      originalPriceAmount: s.price * 100,
      isFeatured: false,
      imageUrl: null,
      slug: s.id,
      description: '',
      isActive: true,
    } as Service));
  }, [allServicesQuery.data]);

  const retry = () => { void dashboard.refetch(); void bookings.refetch(); };

  const changeStatus = (booking: ManagerBooking, status: 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show' | 'pending') => {
    update.mutate(
      { id: booking.id, data: { status: status as any } },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: getListManagerBookingsQueryKey({ date: dateLocal(new Date()) }) });
          void qc.invalidateQueries({ queryKey: getGetManagerDashboardQueryKey() });
          void qc.invalidateQueries({ queryKey: ['audit-logs'] });
        },
      }
    );
  };

  const assignStaff = (booking: ManagerBooking, staffId: string | null) => {
    setAssignmentMessage('');
    setAssignmentError('');
    assign.mutate(
      { id: booking.id, data: { staffId } },
      {
        onSuccess: () => {
          setAssignmentMessage(`${t('Staff assignment saved for')} ${booking.customerName}.`);
          void qc.invalidateQueries({ queryKey: getListManagerBookingsQueryKey({ date: dateLocal(new Date()) }) });
          void qc.invalidateQueries({ queryKey: getGetManagerDashboardQueryKey() });
        },
        onError: () => setAssignmentError(`Erreur lors de l'assignation pour ${booking.customerName}.`),
      }
    );
  };

  const handleSetDiscount = (bookingId: string, percent: number) => {
    const valid = Math.max(0, Math.min(50, Math.round(percent)));
    const next = { ...discounts, [bookingId]: valid };
    setDiscounts(next);
    saveStoredDiscounts(next);
  };

  const handleAddServiceToCart = (bookingId: string, serviceName: string) => {
    if (!serviceName) return;
    const current = extraItems[bookingId] || [];
    const next = { ...extraItems, [bookingId]: [...current, serviceName] };
    setExtraItems(next);
    saveStoredExtraItems(next);
    setServiceToAdd('');
  };

  const handleRemoveServiceFromCart = (bookingId: string, indexToRemove: number) => {
    const current = extraItems[bookingId] || [];
    const next = { ...extraItems, [bookingId]: current.filter((_, idx) => idx !== indexToRemove) };
    setExtraItems(next);
    saveStoredExtraItems(next);
  };

  const rawBookings = Array.isArray(bookings.data) ? bookings.data : [];

  const filteredBookings = useMemo(() => {
    return rawBookings.filter((b) => {
      const matchSearch =
        phoneSearch.trim() === '' ||
        (b.customerPhone && b.customerPhone.toLowerCase().includes(phoneSearch.toLowerCase().trim())) ||
        (b.customerName && b.customerName.toLowerCase().includes(phoneSearch.toLowerCase().trim())) ||
        (b.bookingReference && b.bookingReference.toLowerCase().includes(phoneSearch.toLowerCase().trim()));

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending' && b.status === 'pending') ||
        (statusFilter === 'confirmed' && b.status === 'confirmed') ||
        (statusFilter === 'cancelled' && (b.status === 'cancelled' || b.status === 'no_show')) ||
        (statusFilter === 'completed' && (b.status === 'completed' || b.status === 'checked_in'));

      return matchSearch && matchStatus;
    });
  }, [rawBookings, phoneSearch, statusFilter]);

  const getBookingServicesList = (b: ManagerBooking) => {
    const extracted = extractBookingServices(b.serviceName || '', allAvailableServices);
    const addedNames = extraItems[b.id] || [];
    return [...extracted.names, ...addedNames];
  };

  const getBaseServicesCount = (b: ManagerBooking) => {
    return extractBookingServices(b.serviceName || '', allAvailableServices).names.length;
  };

  const calculateBookingTotal = (b: ManagerBooking) => {
    const extracted = extractBookingServices(b.serviceName || '', allAvailableServices);
    const basePrice = (b as any).priceAmount || extracted.totalPrice;

    const addedNames = extraItems[b.id] || [];
    let addedPrice = 0;
    addedNames.forEach(name => {
      const found = allAvailableServices.find(s => s.name.toLowerCase() === name.toLowerCase());
      if (found) addedPrice += found.priceAmount;
    });

    const grossTotal = basePrice + addedPrice;
    const discountPercent = discounts[b.id] || 0;
    const discountAmount = Math.round((grossTotal * discountPercent) / 100);
    const netTotal = Math.max(0, grossTotal - discountAmount);
    return { grossTotal, discountPercent, discountAmount, netTotal, currency: 'TND' };
  };

  return (
    <div className="mt-8 space-y-8">
      {dashboard.isLoading || bookings.isLoading ? (
        <LoadingBlock label={t('Loading bookings and carts…')} />
      ) : dashboard.isError || bookings.isError ? (
        <ErrorBlock retry={retry} />
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="mono text-[10px] tracking-[.16em] text-primary">{t('DAILY OPERATIONS')}</p><h2 className="serif mt-2 text-3xl">{t('Bookings and follow-up')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('Review requests, confirm visits, and keep the schedule moving.')}</p></div>
            <label className="grid gap-1.5 text-xs text-muted-foreground">{t('Booking date')}<input type="date" value={bookingDate} onChange={event=>setBookingDate(event.target.value)} className="min-h-11 rounded-xl border border-input bg-card px-3 text-sm text-foreground"/></label>
          </div>

          {/* Dashboard Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="mono text-[9px] tracking-[.16em] text-muted-foreground">{t('BOOKINGS ON SELECTED DATE')}</p>
              <p className="serif mt-2 text-4xl font-semibold text-foreground">{rawBookings.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 shadow-sm">
              <p className="mono text-[9px] tracking-[.16em] text-amber-700 dark:text-amber-400">{t('NEEDS CONFIRMATION')}</p>
              <p className="serif mt-2 text-4xl font-semibold text-amber-700 dark:text-amber-400">
                {rawBookings.filter((b) => b.status === 'pending').length}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-sm">
              <p className="mono text-[9px] tracking-[.16em] text-emerald-700 dark:text-emerald-400">{t('CONFIRMED BY PHONE')}</p>
              <p className="serif mt-2 text-4xl font-semibold text-emerald-700 dark:text-emerald-400">
                {rawBookings.filter((b) => b.status === 'confirmed').length}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="mono text-[9px] tracking-[.16em] text-muted-foreground">{t('COMPLETED / PAID')}</p>
              <p className="serif mt-2 text-4xl font-semibold text-primary">
                {rawBookings.filter((b) => b.status === 'completed' || b.status === 'checked_in').length}
              </p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1 max-w-lg">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={phoneSearch}
                  onChange={(e) => setPhoneSearch(e.target.value)}
                  placeholder={t('Search by phone number or customer name…')}
                  className="w-full rounded-full border border-input bg-background pl-10 pr-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none shadow-sm"
                />
                {phoneSearch && (
                  <button
                    onClick={() => setPhoneSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Effacer
                  </button>
                )}
              </div>

              {/* Status Filter Chips */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-muted-foreground me-1 hidden sm:inline">{t('Filter')}:</span>
                {[
                  ['all', t('All')],
                  ['pending', t('Awaiting confirmation')],
                  ['confirmed', t('Confirmed')],
                  ['completed', t('Completed')],
                  ['cancelled', t('Unreachable / Rejected')],
                ].map(([val, lbl]) => (
                  <button
                    key={val}
                    onClick={() => setStatusFilter(val)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                      statusFilter === val
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'border border-border bg-background hover:bg-secondary text-foreground/80'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Feedback banners */}
          {assignmentMessage && (
            <p className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2" role="status">
              <CheckCircle2 size={16} /> {assignmentMessage}
            </p>
          )}
          {assignmentError && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive flex items-center gap-2" role="alert">
              <AlertCircle size={16} /> {assignmentError}
            </p>
          )}

          {/* Bookings & Carts Management Table / Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="mono text-[9px] tracking-[.18em] text-primary">{t('CALLS & CARTS')}</p>
                <h2 className="serif text-3xl mt-1">{t('Customer bookings')}</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {filteredBookings.length} {t('booking(s) shown')}
              </span>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-border p-12 text-center bg-card/50">
                <CalendarDays className="mx-auto text-muted-foreground/40" size={36} />
                <p className="serif mt-3 text-2xl">{t('No matching bookings')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('Adjust the phone search or status filter.')}</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredBookings.map((b) => {
                  const servicesList = getBookingServicesList(b);
                  const { grossTotal, discountPercent, discountAmount, netTotal, currency } = calculateBookingTotal(b);
                  const isCallPending = b.status === 'pending';
                  const isConfirmed = b.status === 'confirmed';
                  const isCancelled = b.status === 'cancelled' || b.status === 'no_show';
                  const isCompleted = b.status === 'completed' || b.status === 'checked_in';

                  return (
                    <div
                      key={b.id}
                      className={`rounded-[1.4rem] border p-5 bg-card transition shadow-sm hover:shadow-md ${
                        isCallPending
                          ? 'border-amber-500/40 bg-amber-500/[0.02]'
                          : isConfirmed
                          ? 'border-emerald-500/30 bg-emerald-500/[0.02]'
                          : isCancelled
                          ? 'border-border/60 opacity-70 bg-muted/20'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        {/* Client Info & Direct Call */}
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="serif text-2xl font-medium text-foreground">{b.customerName}</span>
                            <span className="mono rounded-md bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                              #{b.bookingReference}
                            </span>
                            {isCallPending && (
                              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 animate-pulse">
                                {t('Awaiting call')}
                              </span>
                            )}
                            {isConfirmed && (
                              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                {t('CONFIRMED BY PHONE')}
                              </span>
                            )}
                            {isCancelled && (
                              <span className="rounded-full bg-destructive/15 border border-destructive/30 px-2.5 py-0.5 text-[10px] font-semibold text-destructive">
                                {t('Unreachable / Rejected')}
                              </span>
                            )}
                            {isCompleted && (
                              <span className="rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                                {t('Treatment completed')}
                              </span>
                            )}
                          </div>

                          {/* Phone & Direct Call button */}
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            {b.customerPhone ? (
                              <a
                                href={`tel:${b.customerPhone}`}
                                title={t('Call this number')}
                                className="inline-flex items-center gap-2 rounded-full bg-emerald-600/15 hover:bg-emerald-600 text-emerald-800 dark:text-emerald-300 hover:text-white px-3.5 py-1.5 font-semibold transition border border-emerald-600/30 shadow-sm"
                              >
                                <PhoneCall size={14} />
                                <span>{b.customerPhone}</span>
                                <span className="text-[10px] uppercase underline tracking-wider font-normal">{t('Call')}</span>
                              </a>
                            ) : (
                              <span className="text-muted-foreground italic">{t('No phone number')}</span>
                            )}
                            {b.customerEmail && <span className="text-muted-foreground">{b.customerEmail}</span>}
                            <span className="text-muted-foreground">
                              {new Date(b.startsAt).toLocaleDateString(getIntlLocale(language), { weekday: 'short', day: 'numeric', month: 'short' })} {t('at')}{' '}
                              <strong className="text-foreground">{new Date(b.startsAt).toLocaleTimeString(getIntlLocale(language), { hour: '2-digit', minute: '2-digit' })}</strong>
                            </span>
                          </div>

                          {/* Cart Services Breakdown */}
                          <div className="mt-3 rounded-xl bg-secondary/40 p-3 border border-border/70">
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50 text-xs">
                              <span className="font-medium text-foreground flex items-center gap-1.5">
                                <ShoppingBag size={14} className="text-primary" /> {t('Treatments in cart')} ({servicesList.length}):
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingCartBooking(b)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                              >
                                <Edit3 size={12} /> {t('Edit cart')}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {servicesList.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-lg bg-background border border-border/70 px-2.5 py-1 text-xs text-foreground font-medium flex items-center gap-1.5"
                                >
                                  <span>{item}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Price, Discount & Actions Panel */}
                        <div className="flex flex-col gap-3 min-w-[280px] lg:border-s lg:border-border/70 lg:ps-5">
                          {/* Financial Breakdown */}
                          <div className="rounded-xl bg-background border border-border p-3.5 space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{t('Gross total:')}</span>
                              <span className="font-medium tabular-nums">{formatMoney(grossTotal, currency)}</span>
                            </div>

                            {/* Discount (1-50%) Selector */}
                            <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-xs">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Percent size={13} className="text-primary" /> {t('Discount:')}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={discountPercent}
                                  onChange={(e) => handleSetDiscount(b.id, Number(e.target.value))}
                                  className="rounded-lg border border-input bg-card px-2 py-1 text-xs font-semibold text-primary focus-visible:outline-none"
                                >
                                  <option value={0}>0%</option>
                                  <option value={5}>5%</option>
                                  <option value={10}>10%</option>
                                  <option value={15}>15%</option>
                                  <option value={20}>20%</option>
                                  <option value={25}>25%</option>
                                  <option value={30}>30%</option>
                                  <option value={40}>40%</option>
                                  <option value={50}>50%</option>
                                </select>
                                {discountPercent > 0 && (
                                  <span className="text-[11px] font-semibold text-destructive tabular-nums">
                                    -{formatMoney(discountAmount, currency)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-bold">
                              <span>{t('Net total due:')}</span>
                              <span className="serif text-xl text-primary tabular-nums">{formatMoney(netTotal, currency)}</span>
                            </div>
                          </div>

                          {/* Call & Status Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2">
                            {isCallPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => changeStatus(b, 'confirmed')}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition"
                                >
                                  <Check size={14} /> {t('Confirm call')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => changeStatus(b, 'cancelled')}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/5 hover:bg-destructive/15 px-3 py-2 text-xs font-medium text-destructive transition"
                                  title={t('Mark as unreachable or rejected')}
                                >
                                  <PhoneOff size={14} /> Injoignable
                                </button>
                              </>
                            )}

                            {isConfirmed && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => changeStatus(b, 'completed')}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition"
                                >
                                  <CheckCircle2 size={14} /> {t('COMPLETED / PAID')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => changeStatus(b, 'cancelled')}
                                  className="inline-flex items-center justify-center gap-1 rounded-full border border-border px-2.5 py-2 text-[11px] text-muted-foreground hover:text-destructive transition"
                                >
                                  Annuler
                                </button>
                              </>
                            )}

                            {(isCancelled || isCompleted) && (
                              <button
                                type="button"
                                onClick={() => changeStatus(b, 'pending')}
                                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
                              >
                                <RefreshCw size={12} /> {t('Return to pending')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Edit Cart Modal for Manager */}
          {editingCartBooking && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <p className="mono text-[9px] tracking-[.18em] text-primary">{t('CART MANAGEMENT')}</p>
                    <h3 className="serif text-2xl mt-0.5">{t('Edit cart')} de {editingCartBooking.customerName}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingCartBooking(null)}
                    className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Current items */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">{t('Current treatments in booking:')}</p>
                  <div className="max-h-48 overflow-y-auto space-y-2 pe-1">
                    {getBookingServicesList(editingCartBooking).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-xs">
                        <span className="font-medium truncate">{item}</span>
                        {idx >= getBaseServicesCount(editingCartBooking) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveServiceFromCart(editingCartBooking.id, idx - getBaseServicesCount(editingCartBooking))}
                            className="text-destructive hover:underline text-[11px]"
                          >
                            Retirer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add more services */}
                <div className="space-y-2 border-t border-border pt-4">
                  <label className="text-xs font-semibold text-foreground">{t('Add an extra treatment (offered during the call):')}</label>
                  <div className="flex gap-2">
                    <select
                      value={serviceToAdd}
                      onChange={(e) => setServiceToAdd(e.target.value)}
                      className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none"
                    >
                      <option value="">{t('Choose from available treatments…')}</option>
                      {allAvailableServices.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} ({s.category}) — {formatMoney(s.priceAmount, s.currency)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!serviceToAdd}
                      onClick={() => handleAddServiceToCart(editingCartBooking.id, serviceToAdd)}
                      className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                    >
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingCartBooking(null)}
                    className="rounded-full bg-primary px-6 py-2.5 text-xs font-medium text-primary-foreground shadow-sm"
                  >
                    {t('Done & save')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
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
    '\u00c9pilation',
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
          ? t('Treatment updated successfully.')
          : t('Treatment created successfully.'),
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
    const action = currentStatus ? t('deactivate') : t('reactivate');
    if (!window.confirm(`${t('Would you like to')} ${action} ${t('this treatment?')}`)) return;
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
            <p className="mono text-[9px] tracking-[.18em] text-primary">BASE DE DONN&Eacute;ES DU SALON</p>
            <h2 className="serif mt-2 text-4xl">Catalogue des Prestations</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {items.length} {t('treatments saved in the catalog')}
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
                            &Agrave; la une
                          </span>
                        )}
                        {!item.isActive && (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                            {t('Disabled')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                        {item.shortDescription}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className="font-semibold text-primary">{Math.round(item.priceAmount * (100-item.discountPercent) / 10000)} dt</span>{item.discountPercent>0&&<><del className="text-muted-foreground">{Math.round(item.priceAmount/100)} dt</del><span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">-{item.discountPercent}%</span></>}
                        <span className="text-muted-foreground">&bull; {item.durationMinutes} min</span>
                        <span className="text-[10px] text-muted-foreground mono">
                          {item.imageUrl ? t('Photo set') : t('No photo')}
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
                      title={item.isActive ? t('Deactivate') : t('Reactivate')}
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
          {editing ? t('Edit treatment') : t('Create a treatment')}
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

          {/* t('Category') */}
          <div className="grid gap-1 text-xs font-medium">
            <label>{t('Category')} *</label>
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
              <option value="Autre">{t('Other (custom)')}</option>
            </select>
            {form.category === 'Autre' && (
              <input
                required
                value={form.customCategory}
                onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                placeholder={t('New category name')}
                className="mt-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            )}
          </div>

          {/* Description courte */}
          <label className="grid gap-1 text-xs font-medium">
            {t('Short description (shown on the card)')} *
            <input
              required
              value={form.shortDescription}
              onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
              placeholder={t('Deep cleansing and facial glow treatment.')}
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            />
          </label>

          {/* Description complète */}
          <label className="grid gap-1 text-xs font-medium">
            {t('Full description (treatment page)')}
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('Treatment steps and benefits…')}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          {/* Gestion de l'image (Upload ou URL) */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Photo du soin</span>
              <span className="text-[10px] text-primary mono bg-primary/10 px-2 py-0.5 rounded-full">
                800 &times; 600 px {t('recommended')}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-4">
              {t('Recommended formats: JPEG, PNG or WebP (4:3 or 16:9 ratio, max 3 MB).')}
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
                <Camera size={15} aria-hidden="true" /> Choisir une photo locale
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
                  alt={t('Treatment preview')}
                  className="h-32 w-full object-cover"
                />
                <span className="absolute bottom-1.5 start-2 rounded bg-black/60 px-2 py-0.5 text-[9px] text-white backdrop-blur">
                  {t('Live preview')}
                </span>
              </div>
            )}
          </div>

          {/* {t('Price in dinars and duration')} */}
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
              {t('Duration (minutes)')} *
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
  const tabs=[['overview',t("Bookings & reservations")],['staff',t('Staff')],['customers',t('Customers')],['services',t('Treatments')],['audit',t('Audit logs')]] as const;
  return <><Meta title={tab==='overview'?"Paniers & Réservations":tabs.find(item=>item[0]===tab)?.[1]||'Staff desk'} description="Gestion des paniers, appels clients et réservations."/><main className="page-enter mx-auto max-w-[1320px] px-5 py-12 md:px-10 md:py-16"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mono text-[10px] tracking-[.2em] text-primary">{t("SALON ADMINISTRATION")}</p><h1 className="serif mt-3 text-5xl md:text-6xl">{tab==='overview'?t("Bookings & reservations"):tabs.find(item=>item[0]===tab)?.[1]}</h1><p className="mt-3 text-sm text-muted-foreground">{t("Manage confirmation calls, discounts (1-50%), and cart changes.")}</p></div><HealthPip/></div><div className="mt-8 flex flex-wrap gap-2 border-b border-border pb-3">{tabs.map(([value,label])=><button key={value} type="button" onClick={()=>setTab(value)} className={`rounded-full px-4 py-2.5 text-xs ${tab===value?'bg-primary text-primary-foreground font-medium':'border border-border bg-card hover:bg-secondary'}`} data-testid={`tab-manager-${value}`}>{label}</button>)}</div>{tab==='overview'&&<DashboardInner/>}{tab==='staff'&&<StaffManagementPanel/>}{tab==='customers'&&<CustomerManagementPanel/>}{tab==='services'&&<ServicesManagementPanel/>}{tab==='audit'&&<AuditPage businessOnly={user?.publicMetadata?.role !== 'admin'}/>}</main></>;
}

export function AuditPage({ businessOnly = false }: { businessOnly?: boolean }) {
  const {t,language}=useLanguage();
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
  return <><Meta title="Audit log" description="Owner audit history for operational changes."/><main className="page-enter mx-auto max-w-[1320px] px-5 py-12 md:px-10 md:py-16"><p className="mono text-[10px] tracking-[.2em] text-primary">OWNER VIEW</p><h1 className="serif mt-3 text-5xl md:text-6xl">Audit trail.</h1><p className="mt-3 text-sm text-muted-foreground">A record of actions returned by the protected service.</p><section className="mt-8 rounded-[1.5rem] border border-border bg-card p-5 md:p-7"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h2 className="serif text-3xl">Recent events</h2><p className="mt-1 text-xs text-muted-foreground">Rows below are live API data; no sample events are inserted.</p></div><div className="flex flex-wrap gap-2"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search events" className="rounded-xl border border-input bg-background px-4 py-3 text-sm md:w-56" data-testid="input-audit-search"/><select aria-label="Filter audit log by record type" value={entityFilter} onChange={e=>setEntityFilter(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"><option value="all">All records</option>{['booking','service','customer','staff','account','settings'].map(value=><option key={value} value={value}>{value[0]?.toUpperCase()}{value.slice(1)}</option>)}</select><select aria-label="Filter audit log by actor" value={actorFilter} onChange={e=>setActorFilter(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-3 text-sm"><option value="all">All actors</option><option value="guest">{t("Guests")}</option><option value="customer">Customer accounts</option><option value="staff">Staff / admins</option></select></div></div>{logs.isLoading?<LoadingBlock label="Loading audit events"/>:logs.isError?<ErrorBlock retry={()=>void logs.refetch()}/>:filtered.length?<div className="mt-5 overflow-x-auto"><table className="w-full min-w-[690px] border-collapse text-start text-sm"><thead><tr className="border-b border-border text-[10px] tracking-[.1em] text-muted-foreground"><th className="py-3 font-normal">WHEN</th><th className="py-3 font-normal">ACTOR</th><th className="py-3 font-normal">ACTION</th><th className="py-3 font-normal">ENTITY</th><th className="py-3 font-normal">ID</th></tr></thead><tbody>{filtered.map((row:AuditEvent)=><tr key={row.id} className="border-b border-border/70"><td className="py-4 text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString(getIntlLocale(language))}</td><td className="py-4">{row.actorLabel}</td><td className="py-4">{row.action}</td><td className="py-4">{row.entityType}</td><td className="mono py-4 text-xs">{row.entityId}</td></tr>)}</tbody></table></div>:<div className="py-14 text-center"><p className="serif text-3xl">Nothing to show yet.</p><p className="mt-2 text-sm text-muted-foreground">{Array.isArray(logs.data)&&logs.data.length?'No events match those filters.':'No audit events have been returned.'}</p></div>}</section></main></>;
}
