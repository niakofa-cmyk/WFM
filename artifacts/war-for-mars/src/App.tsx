import { ClerkProvider, SignIn, SignUp, UserButton, useAuth } from "@clerk/react";
import { GlobalCampaignStatus } from "./game/GlobalCampaignStatus";
import { configuredClerkPublishableKey } from "./auth/clerk-config";
import { shadcn } from "@clerk/themes";
import { lazy, Suspense, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { ActionRecovery } from "./game/useDurableAction";
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from "wouter";
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
            Enter one living multiplayer universe. Join the campaign at its current shared progress;
            the war continues while you are away. Your pilot keeps earned equipment and rewards.
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
          </div>
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
      <GlobalCampaignStatus />
      <div data-testid="account-control" className="wfm-account-control fixed right-3 top-3 z-[100]">
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
      <Link data-testid="link-universe-home" href="/" className="min-h-11 py-3 text-sm text-muted">BACK TO COMMAND</Link>
    </main>
  );
  if (orbital) return <PublicLanding />;
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
        <Route path="/command"><Redirect to="/" /></Route>
        <Route path="/universe"><Redirect to="/" /></Route>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/expedition">
          <Redirect to="/" />
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
          <Redirect to="/" />
        </Route>
        <Route path="/play">
          <Redirect to="/" />
        </Route>
        <Route><Routes /></Route>
      </Switch>
    </WouterRouter>
  );
}

export default App;
