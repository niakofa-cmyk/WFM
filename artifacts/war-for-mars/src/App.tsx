import { ClerkProvider, SignIn, SignUp, UserButton, useAuth } from "@clerk/react";
import { configuredClerkPublishableKey } from "./auth/clerk-config";
import { shadcn } from "@clerk/themes";
import { lazy, Suspense, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { ActionRecovery } from "./game/useDurableAction";
import { Link, Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import { PublicWingLeaderboard } from "./game/PublicWingLeaderboard";
import { CommandBackdrop, CommandPanel, FactionMark, PanelLabel, Wordmark } from "./game/CommandArt";
import { SORTIES } from "./game/campaign";
import { expeditionFeatureEnabled } from "./game/sector-client";
import { resolveWfmBoot } from "./game/wfm-boot";

const expeditionEnabled = expeditionFeatureEnabled({
  DEV: import.meta.env.DEV,
  VITE_WFM_SECTOR_EXPEDITION_ENABLED: import.meta.env.VITE_WFM_SECTOR_EXPEDITION_ENABLED,
});

const WarApp = lazy(() => import("./game/WarApp").then((module) => ({ default: module.WarApp })));
const OrbitalBoot = lazy(() => import("./game/OrbitalBoot").then((module) => ({ default: module.OrbitalBoot })));
const SoloFlight = lazy(() => import("./game/SoloFlight").then((module) => ({ default: module.SoloFlight })));
const SectorExpedition = lazy(() => import("./game/SectorExpedition").then((module) => ({ default: module.SectorExpedition })));
const RustDiscFlight = lazy(() => import("./game/RustDiscFlight").then((module) => ({ default: module.RustDiscFlight })));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || null;

setBaseUrl(apiBaseUrl);

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

const appearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/favicon.svg`,
  },
  variables: {
    colorPrimary: "#e0a15a",
    colorForeground: "#e6e1d6",
    colorMutedForeground: "#aaa295",
    colorDanger: "#c45c48",
    colorBackground: "#141820",
    colorInput: "#07080d",
    colorInputForeground: "#e6e1d6",
    colorNeutral: "#8d877c",
    fontFamily: "Barlow Condensed, sans-serif",
    borderRadius: "8px",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#141820] border border-white/10 rounded-xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#e6e1d6]",
    headerSubtitle: "text-[#aaa295]",
    socialButtonsBlockButtonText: "text-[#e6e1d6]",
    formFieldLabel: "text-[#e6e1d6]",
    footerActionLink: "text-[#e0a15a]",
    footerActionText: "text-[#aaa295]",
    dividerText: "text-[#aaa295]",
    identityPreviewEditButton: "text-[#e0a15a]",
    formFieldSuccessText: "text-[#d8c8a4]",
    alertText: "text-[#e6e1d6]",
    logoBox: "h-10",
    logoImage: "max-h-10",
    socialButtonsBlockButton: "border border-white/15 bg-[#07080d]",
    formButtonPrimary: "bg-[#e0a15a] text-[#07080d]",
    formFieldInput: "border-white/20 bg-[#07080d] text-[#e6e1d6]",
    footerAction: "border-white/10",
    dividerLine: "bg-white/15",
    alert: "border-[#c45c48]/50 bg-[#c45c48]/10",
    otpCodeFieldInput: "border-white/20 bg-[#07080d] text-[#e6e1d6]",
    formFieldRow: "text-[#e6e1d6]",
    main: "text-[#e6e1d6]",
  },
};

function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-void px-4 py-8">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </main>
  );
}

function SignUpPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-void px-4 py-8">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </main>
  );
}

function PublicLanding() {
  const { isSignedIn } = useAuth();
  const cta = "wfm-cmd wfm-chamfer min-h-12 justify-center px-6 font-hud text-lg tracking-widest";
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-void text-bone">
      <section className="relative flex min-h-[92dvh] items-end">
        <CommandBackdrop />
        <div className="wfm-safe relative mx-auto w-full max-w-6xl pb-14 pt-24 sm:px-12">
          <div className="wfm-rise flex items-center gap-3">
            <FactionMark faction="ussf" className="h-10 w-10" />
            <span aria-hidden="true" className="h-8 w-px bg-bone/25" />
            <FactionMark faction="accord" className="h-10 w-10" />
            <p className="ml-2 font-hud text-xs tracking-[0.28em] text-solar sm:text-sm">THE INFINITE WAR · USSF VS THE ACCORD · PHOBOS THEATER · 5V5</p>
          </div>
          <h1 className="mt-6">
            <span className="sr-only">WAR FOR MARS</span>
            <Wordmark className="wfm-arrive w-full max-w-4xl" />
          </h1>
          <span aria-hidden="true" className="wfm-sweep mt-5 block h-px w-full max-w-4xl bg-gradient-to-r from-solar via-solar/40 to-transparent" />
          <p className="wfm-rise-2 mt-6 max-w-xl text-base leading-relaxed text-bone/85 sm:text-lg">
            Fly the campaign, refit your ship, or bring a wing into a private ten-pilot match.
            Your account keeps campaign progress and credits safe on the server.
          </p>
          <div className="wfm-rise-3 mt-8 flex max-w-2xl flex-wrap gap-3">
            {isSignedIn ? (
              <Link href="/" className={`${cta} wfm-cmd-primary`}>OPEN HANGAR</Link>
            ) : (
              <>
                <Link href="/sign-up" className={`${cta} wfm-cmd-primary`}>CREATE PILOT ACCOUNT</Link>
                <Link href="/sign-in" className={`${cta} wfm-cmd-secondary`}>SIGN IN</Link>
              </>
            )}
            <a href="/combat-lab.html?universe=1" data-testid="link-landing-local-universe" className={`${cta} wfm-cmd-secondary`}>ENTER ORBITAL UNIVERSE · LOCAL FLIGHT</a>
            <Link href="/play" className={`${cta} wfm-cmd-quiet`}>TRY SOLO FLIGHT · LOCAL</Link>
          </div>
          <details data-testid="details-public-operations" className="group wfm-rise-3 mt-3 max-w-2xl border border-bone/15 bg-panel/70">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 font-hud text-sm tracking-[0.16em] text-bone marker:content-none">
              <span className="min-w-0">
                <span className="block">TRAINING & COMPATIBILITY</span>
                <span className="mt-1 block font-sans text-[11px] tracking-normal text-muted">Cooperate in the shared universe · legacy operations retained for rollback</span>
              </span>
              <span className="ml-auto shrink-0 text-[10px] text-muted group-open:hidden">SHOW</span>
              <span className="ml-auto hidden shrink-0 text-[10px] text-muted group-open:inline">HIDE</span>
            </summary>
            <div className="grid gap-2 border-t border-bone/10 p-2 sm:grid-cols-2">
              <a href="/combat-lab.html" data-testid="link-landing-combat-lab" className={`${cta} wfm-cmd-secondary min-h-14 flex-col items-start justify-center px-4 text-left`}>
                <span>ORBITAL COMBAT LAB · OFFLINE</span>
                <span className="font-sans text-xs tracking-normal text-muted">Orbital training runtime · no rewards</span>
              </a>
              {expeditionEnabled ? (
                <Link href={isSignedIn ? "/" : "/sign-in"} data-testid="link-landing-expedition" className={`${cta} wfm-cmd-secondary min-h-14 flex-col items-start justify-center px-4 text-left sm:col-span-2`}>
                  <span>SHARED UNIVERSE · ALLIED SUPPORT</span>
                  <span className="font-sans text-xs tracking-normal text-muted">Enter through the hangar · assist nearby allied pilots in live flight</span>
                </Link>
              ) : null}
            </div>
          </details>
        </div>
      </section>

      <section className="wfm-safe relative mx-auto grid w-full max-w-6xl gap-4 py-12 sm:px-12 md:grid-cols-2">
        {([
          ["ussf", "USSF", "Sensors, wards, the glide. Blue signatures and precision flight.", "text-spectral"],
          ["accord", "THE ACCORD", "Solar, stealth, the rings. Amber energy and unfamiliar geometry.", "text-solar"],
        ] as const).map(([id, name, line, tone]) => (
          <CommandPanel key={id} className="flex items-center gap-4 p-5">
            <FactionMark faction={id} className="h-16 w-16" />
            <div>
              <p className={`font-hud text-3xl leading-none tracking-wide ${tone}`}>{name}</p>
              <p className="mt-1 text-sm text-muted">{line}</p>
            </div>
          </CommandPanel>
        ))}
      </section>

      <section className="wfm-safe relative mx-auto grid w-full max-w-6xl gap-6 pb-16 sm:px-12 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <PanelLabel>PHOBOS YARD BRIEF</PanelLabel>
          <p className="mt-3 font-hud text-4xl leading-none sm:text-5xl">FOUR SORTIES. ONE OPEN WAR.</p>
          <ol className="mt-6 grid gap-2 sm:grid-cols-2">
            {SORTIES.map((sortie, i) => (
              <li key={sortie.id} className="wfm-panel p-4">
                <p className="font-hud text-xs tracking-[0.22em] text-muted">SORTIE {String(i + 1).padStart(2, "0")}</p>
                <p className="font-hud text-2xl leading-none">{sortie.name.toUpperCase()}</p>
                <p className="mt-1 font-hud text-sm tracking-widest text-solar">{sortie.objective}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 font-hud text-xs tracking-widest text-bone/70">PROGRESS IS VERIFIED BY THE SERVER</p>
        </div>
        <CommandPanel accent className="p-5">
          <PublicWingLeaderboard />
        </CommandPanel>
      </section>
    </main>
  );
}

function SignedInGame({ universe = false, orbital = false }: { universe?: boolean; orbital?: boolean }) {
  const client = useQueryClient();
  useEffect(() => () => { client.clear(); }, [client]);
  return (
    <>
      <Suspense fallback={<main role="status" className="flex min-h-dvh items-center justify-center bg-void text-bone">Loading flight systems…</main>}>
        <WarApp initialUniverseOpen={universe} initialOrbitalOpen={orbital} />
      </Suspense>
      <ActionRecovery />
      <div className="fixed right-3 top-3 z-[100]">
        <UserButton />
      </div>
    </>
  );
}

function AccountGameEntry({ universe = false, primary = false }: { universe?: boolean; primary?: boolean }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  // Discovery and solo entry remain visible while hosted authentication loads.
  // Never mount account/progression hooks until the session is confirmed.
  const orbital = primary && resolveWfmBoot(window.location.search, import.meta.env.VITE_WFM_ORBITAL_BOOT_ENABLED !== "false") === "orbital";
  if (isLoaded && isSignedIn) return <SignedInGame key={`${userId}:${universe}:${orbital}`} universe={universe} orbital={orbital} />;
  if (universe) return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-void px-6 py-12 text-bone">
      <p className="font-hud text-xs tracking-widest text-solar">WAR FOR MARS / ORBITAL NAVIGATION</p>
      <h1 className="font-hud text-4xl">CONNECT TO YOUR UNIVERSE</h1>
      <p className="max-w-lg text-sm text-muted">Your saved position, route costs and operation access come from your signed-in account. Offline training remains available without an account.</p>
      {isLoaded ? <Link data-testid="link-sign-in-universe" href={`/sign-in?redirect_url=${encodeURIComponent(`${basePath}/universe`)}`} className="flex min-h-12 items-center bg-solar px-6 font-hud text-void">SIGN IN TO CONNECT</Link>
        : <p role="status" data-testid="status-universe-session">Checking pilot session…</p>}
      <a data-testid="link-offline-orbital" className="min-h-11 border border-bone/30 px-5 py-3 text-sm" href={`${basePath}/combat-lab.html`}>OFFLINE ORBITAL TRAINING</a>
      <Link data-testid="link-universe-home" href="/" className="min-h-11 py-3 text-sm text-muted">BACK TO COMMAND</Link>
    </main>
  );
  if (orbital) return <Suspense fallback={<main role="status" className="lab-loading">Initializing Orbital…</main>}><OrbitalBoot /></Suspense>;
  return <PublicLanding />;
}

function ApiAuthBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!apiBaseUrl) {
      setAuthTokenGetter(null);
      return;
    }

    setAuthTokenGetter(() =>
      isLoaded && isSignedIn ? getToken() : null,
    );
    return () => setAuthTokenGetter(null);
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}

function Routes() {
  const [, setLocation] = useLocation();
  const clerkPubKey = configuredClerkPublishableKey(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={appearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back, pilot", subtitle: "Return to the Phobos yard" } },
        signUp: { start: { title: "Create your pilot account", subtitle: "Your campaign progress stays with you" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ApiAuthBridge />
      <Switch>
        <Route path="/"><AccountGameEntry primary /></Route>
        <Route path="/command"><AccountGameEntry /></Route>
        <Route path="/universe"><AccountGameEntry universe /></Route>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/expedition">
          <Suspense fallback={<main role="status" className="flex min-h-dvh items-center justify-center bg-void text-bone">Loading sector expedition…</main>}>
            <SectorExpedition />
          </Suspense>
        </Route>
        <Route component={PublicLanding} />
      </Switch>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <Switch>
        <Route path="/flight">
          <Suspense fallback={<main role="status" className="flex min-h-dvh items-center justify-center bg-void text-bone">Loading Rust Disc flight sector…</main>}>
            <RustDiscFlight expeditionHref={expeditionEnabled ? "/expedition" : undefined} />
          </Suspense>
        </Route>
        <Route path="/play">
          <Suspense fallback={<main role="status" className="flex min-h-dvh items-center justify-center bg-void text-bone">Loading solo flight…</main>}>
            <SoloFlight />
          </Suspense>
        </Route>
        <Route><Routes /></Route>
      </Switch>
    </WouterRouter>
  );
}

export default App;
