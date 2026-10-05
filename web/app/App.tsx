import { type ReactNode, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp } from '@clerk/react';
import { useClerk, useUser, hasValidClerkKey } from '@/lib/safe-clerk';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { ThemeProvider } from 'next-themes';
import { useTheme } from 'next-themes';
import { LanguageProvider, useLanguage } from '@/lib/i18n';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/app/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
  Link,
} from 'wouter';
import {
  AccountPage, AuditPage, BookingPage, ConfirmationPage, GuestBookingManagementPage, HomePage, ManagerPage, PoliciesPage,
  ServiceDetailPage, ServicesPage, SiteShell,
} from '@/components/SpaPages';
import { ArrowRight, Flower2, ShieldCheck } from 'lucide-react';

const queryClient = new QueryClient();

const rawClerkPubKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  '';

let clerkPubKey: string | undefined = undefined;
if (hasValidClerkKey && rawClerkPubKey) {
  try {
    clerkPubKey = publishableKeyFromHost(window.location.hostname, rawClerkPubKey) || rawClerkPubKey;
  } catch {
    clerkPubKey = rawClerkPubKey;
  }
}
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#214b40',
    colorForeground: '#273d36',
    colorMutedForeground: '#687a70',
    colorDanger: '#a7463e',
    colorBackground: '#faf8f1',
    colorInput: '#f6f3e9',
    colorInputForeground: '#273d36',
    colorNeutral: '#d7d1c4',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-card rounded-[24px] w-[440px] max-w-full overflow-hidden border border-border',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-foreground font-medium',
    headerSubtitle: 'text-muted-foreground',
    socialButtonsBlockButtonText: 'text-foreground',
    formFieldLabel: 'text-foreground',
    footerActionLink: 'text-primary font-semibold',
    footerActionText: 'text-muted-foreground',
    dividerText: 'text-muted-foreground',
    identityPreviewEditButton: 'text-primary',
    formFieldSuccessText: 'text-primary',
    alertText: 'text-foreground',
    logoBox: 'rounded-2xl',
    logoImage: 'rounded-2xl',
    socialButtonsBlockButton: 'border-border bg-background rounded-xl',
    formButtonPrimary: 'bg-primary hover:opacity-90 text-primary-foreground rounded-full',
    formFieldInput: 'bg-background border-border text-foreground rounded-xl',
    footerAction: 'border-t border-border',
    dividerLine: 'bg-border',
    alert: 'rounded-xl',
    otpCodeFieldInput: 'bg-background border-border text-foreground',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener((event: unknown) => {
      const userId = (event as { user?: { id?: string } }).user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        client.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function useStaffNavigationVisible() {
  const { user } = useUser();
  const role = typeof user?.publicMetadata?.role === 'string' ? user.publicMetadata.role : null;
  return role === 'manager' || role === 'admin';
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function BrandedAuthLayout({ children, type }: { children: ReactNode; type: 'sign-in' | 'sign-up' }) {
  return <main className="grid min-h-[100dvh] bg-background lg:grid-cols-[.8fr_1.2fr]">
    <section className="relative hidden overflow-hidden bg-primary px-12 py-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
      <Link href="/" className="flex items-center gap-3 text-primary-foreground">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-foreground/10"><Flower2 size={22}/></span>
        <span className="serif text-3xl">Complexe Rouis</span>
      </Link>
      <div className="relative z-10 pb-10"><p className="mono text-[9px] tracking-[.2em] text-primary-foreground/60">SPA WORKSPACE</p><p className="serif mt-4 max-w-md text-6xl leading-[.96]">A little space to come back to yourself.</p><p className="mt-5 max-w-sm text-sm leading-6 text-primary-foreground/65">Sign in with your spa account. Your account role determines which workspace you can access.</p></div>
      <div className="absolute -right-20 top-[23%] h-80 w-80 rounded-full border border-primary-foreground/10"/><div className="absolute -right-5 top-[31%] h-52 w-52 rounded-full border border-primary-foreground/10"/>
      <p className="mono text-[9px] tracking-[.18em] text-primary-foreground/45">DEMO SETUP · BUSINESS DETAILS ARE PLACEHOLDERS</p>
    </section>
    <section className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-8">
      <div className="mb-7 flex w-full max-w-[440px] items-center justify-between lg:hidden"><Link href="/" className="flex items-center gap-2"><Flower2 className="text-primary" size={22}/><span className="serif text-2xl">Complexe Rouis</span></Link><Link href="/" className="text-xs text-muted-foreground">Back home</Link></div>
      <div className="w-full max-w-[440px]">{children}</div>
      <p className="mt-7 flex items-center gap-2 text-[10px] text-muted-foreground"><ShieldCheck size={13}/> {type === 'sign-in' ? 'Your account, securely managed.' : 'A little pause starts here.'}</p>
    </section>
  </main>;
}

function SignInPage() {
  if (!hasValidClerkKey) {
    return <BrandedAuthLayout type="sign-in">
      <div className="w-full rounded-[2rem] border border-dashed border-border bg-card p-8 text-center">
        <p className="mono text-[9px] tracking-[.2em] text-primary">DEMO MODE</p>
        <h2 className="serif mt-3 text-3xl">Clerk auth is not configured yet.</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Add your real Clerk publishable key in the .env file to enable sign-in and protected routes.</p>
      </div>
    </BrandedAuthLayout>;
  }

  return <BrandedAuthLayout type="sign-in">
    <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={`${basePath}/manager`} />
  </BrandedAuthLayout>;
}
function SignUpPage() {
  if (!hasValidClerkKey) {
    return <BrandedAuthLayout type="sign-up">
      <div className="w-full rounded-[2rem] border border-dashed border-border bg-card p-8 text-center">
        <p className="mono text-[9px] tracking-[.2em] text-primary">DEMO MODE</p>
        <h2 className="serif mt-3 text-3xl">Create a local demo account later.</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Once your Clerk app is configured, this screen will unlock the real sign-up flow.</p>
      </div>
    </BrandedAuthLayout>;
  }

  return <BrandedAuthLayout type="sign-up">
    <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
  </BrandedAuthLayout>;
}

function SignInPrompt({ owner = false }: { owner?: boolean }) {
  return <SiteShell><main className="mx-auto grid min-h-[55vh] max-w-4xl place-items-center px-5 py-16"><div className="w-full max-w-xl rounded-[2rem] border border-border bg-card px-8 py-12 text-center"><ShieldCheck className="mx-auto text-primary" size={34}/><p className="mono mt-5 text-[9px] tracking-[.2em] text-primary">{owner ? 'OWNER ACCESS' : 'SPA WORKSPACE'}</p><h1 className="serif mt-3 text-4xl">{owner ? 'Sign in to continue.' : 'Your spa workspace.'}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in with your spa account. Permissions follow the role assigned to that account and are checked by the service.</p><Link href="/sign-in" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground">Sign in <ArrowRight size={15}/></Link></div></main></SiteShell>;
}
function ProtectedManager() {
  if (!hasValidClerkKey) {
    return <SiteShell><ManagerPage/></SiteShell>;
  }

  return <>
    <Show when="signed-in"><ManagerAccessGate/></Show>
    <Show when="signed-out"><SignInPrompt/></Show>
  </>;
}

function ManagerAccessGate() {
  const { user } = useUser();
  const role = typeof user?.publicMetadata?.role === 'string' ? user.publicMetadata.role : null;
  if (role !== 'manager' && role !== 'admin') {
    return <SiteShell><main className="mx-auto grid min-h-[55vh] max-w-4xl place-items-center px-5 py-16"><div className="w-full max-w-xl rounded-[2rem] border border-border bg-card px-8 py-12 text-center"><ShieldCheck className="mx-auto text-primary" size={34}/><p className="mono mt-5 text-[9px] tracking-[.2em] text-primary">STAFF ACCESS</p><h1 className="serif mt-3 text-4xl">Manager access required.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">This account does not have manager or admin permissions. Sign out and use an authorized staff account to open the workspace.</p></div></main></SiteShell>;
  }
  return <SiteShell><ManagerPage/></SiteShell>;
}
function ProtectedAudit() {
  if (!hasValidClerkKey) {
    return <SiteShell><AuditPage/></SiteShell>;
  }

  return <>
    <Show when="signed-in"><SiteShell><AuditPage/></SiteShell></Show>
    <Show when="signed-out"><SignInPrompt owner/></Show>
  </>;
}

function ProtectedAccount() {
  if (!hasValidClerkKey) {
    return <SiteShell><AccountPage/></SiteShell>;
  }

  return <>
    <Show when="signed-in"><SiteShell><AccountPage/></SiteShell></Show>
    <Show when="signed-out"><SignInPrompt/></Show>
  </>;
}

function Router() {
  return <RoutedErrorBoundary>
    <Switch>
      <Route path="/" component={() => <SiteShell><HomePage/></SiteShell>}/>
      <Route path="/services" component={() => <SiteShell><ServicesPage/></SiteShell>}/>
      <Route path="/services/:slug">{params => <SiteShell><ServiceDetailPage slug={params.slug}/></SiteShell>}</Route>
      <Route path="/book" component={() => <SiteShell><BookingPage/></SiteShell>}/>
      <Route path="/booking/confirmed" component={() => <SiteShell><ConfirmationPage/></SiteShell>}/>
      <Route path="/booking/manage" component={() => <SiteShell><GuestBookingManagementPage/></SiteShell>}/>
      <Route path="/policies" component={() => <SiteShell><PoliciesPage/></SiteShell>}/>
      <Route path="/privacy" component={() => <SiteShell><PoliciesPage privacy/></SiteShell>}/>
      <Route path="/account" component={ProtectedAccount}/>
      <Route path="/manager" component={ProtectedManager}/>
      <Route path="/admin/audit-logs" component={ProtectedAudit}/>
      <Route path="/sign-in/*?" component={SignInPage}/>
      <Route path="/sign-up/*?" component={SignUpPage}/>
      <Route component={NotFound}/>
    </Switch>
  </RoutedErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const { resolvedTheme } = useTheme();
  const { t } = useLanguage();

  if (!hasValidClerkKey || !clerkPubKey) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={{
      ...clerkAppearance,
      variables: {
        ...clerkAppearance.variables,
        colorBackground: resolvedTheme === 'dark' ? '#24312e' : '#faf8f1',
        colorForeground: resolvedTheme === 'dark' ? '#eee8d6' : '#273d36',
        colorInput: resolvedTheme === 'dark' ? '#1b2724' : '#f6f3e9',
        colorInputForeground: resolvedTheme === 'dark' ? '#eee8d6' : '#273d36',
        colorNeutral: resolvedTheme === 'dark' ? '#43524e' : '#d7d1c4',
      },
    }}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: t('Welcome back'), subtitle: t('Sign in for your Stillroom account') } },
      signUp: { start: { title: t('Make room for you'), subtitle: t('Create your Stillroom account') } },
    }}
    routerPush={(to: string) => setLocation(stripBase(to))}
    routerReplace={(to: string) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ClerkQueryClientCacheInvalidator/>
        <Router/>
        <Toaster/>
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <LanguageProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes/>
      </WouterRouter>
    </LanguageProvider>
  </ThemeProvider>;
}

export default App;
