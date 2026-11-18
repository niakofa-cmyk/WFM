import { ClerkProvider, SignIn, SignUp, UserButton, useAuth } from "@clerk/react";
import { setBaseUrl } from "@workspace/api-client-react";
import { GameApiSession } from "./game/GameApiSession";
import { configuredClerkPublishableKey, gameAuthReturnUrl } from "./auth/clerk-config";
import { shadcn } from "@clerk/themes";
import { lazy, Suspense } from "react";
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import { AuthInitialization } from "./components/auth-initialization";

const WarApp = lazy(() => import("./game/WarApp").then((module) => ({ default: module.WarApp })));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = configuredClerkPublishableKey(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const gameEntryUrl = gameAuthReturnUrl(basePath);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || null;

// Keep API routing explicit when the game API is hosted separately.
setBaseUrl(apiBaseUrl);

function stripBase(path: string) {
  return basePath && (path === basePath || path.startsWith(`${basePath}/`))
    ? path.slice(basePath.length) || "/"
    : path;
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
    <main
      data-testid="orbital-signin-page"
      className="relative flex min-h-dvh items-center justify-center bg-void px-4 py-8"
    >
      <div className="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top)+1rem)] text-center">
        <p className="font-hud text-xs tracking-[0.28em] text-solar">
          WAR FOR MARS · ORBITAL UNIVERSE
        </p>
        <p className="mt-1 font-hud text-[10px] tracking-[0.2em] text-muted">
          SECURE PILOT ACCESS · SHARED CAMPAIGN
        </p>
      </div>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={gameEntryUrl} />
    </main>
  );
}

function SignUpPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-void px-4 py-8">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={gameEntryUrl} />
    </main>
  );
}

function PublicLanding() {
  return (
    <main className="relative flex min-h-dvh items-center overflow-hidden bg-void px-6 py-12 text-bone sm:px-12">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_50%,rgba(138,58,36,0.25),transparent_52%)]" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 md:grid-cols-[1.15fr_0.85fr]">
        <section>
          <p className="font-hud text-sm tracking-[0.28em] text-solar">PHOBOS MOON · 5V5 COMBAT</p>
          <h1 className="mt-4 max-w-3xl font-hud text-7xl leading-[0.82] tracking-tight text-bone sm:text-9xl">
            WAR
            <br />
            FOR MARS
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Fly the campaign, refit your ship, or bring a wing into a private ten-pilot match.
            Your account keeps campaign progress and credits safe on the server.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="inline-flex h-12 items-center bg-solar px-6 font-hud text-lg tracking-widest text-void"
            >
              CREATE PILOT ACCOUNT
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-12 items-center border border-bone/30 px-6 font-hud text-lg tracking-widest text-bone"
            >
              SIGN IN
            </Link>
          </div>
        </section>
        <aside className="border border-bone/15 bg-panel/80 p-5">
          <p className="font-hud text-sm tracking-widest text-solar">PHOBOS YARD BRIEF</p>
          <p className="mt-3 font-hud text-3xl leading-none text-bone">FOUR SORTIES. ONE OPEN WAR.</p>
          <ul className="mt-5 space-y-3 text-sm leading-relaxed text-muted">
            <li>Hold the rust disc and answer the first signal.</li>
            <li>Light the pale beacons, then hunt the night-side Warden.</li>
            <li>Choose whether the final cage makes it through the dust lane.</li>
          </ul>
          <p className="mt-6 border-t border-bone/10 pt-4 font-hud text-xs tracking-widest text-bone/70">
            PROGRESS IS VERIFIED BY THE SERVER
          </p>
        </aside>
      </div>
    </main>
  );
}

function SignedInGame() {
  return (
    <GameApiSession>
      <>
        <Suspense fallback={<main role="status" className="flex min-h-dvh items-center justify-center bg-void text-bone">Loading flight systems…</main>}>
          <WarApp />
        </Suspense>
        <div className="fixed right-3 top-3 z-[100]">
          <UserButton />
        </div>
      </>
    </GameApiSession>
  );
}

function AccountGameEntry() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  // Never mount account or progression hooks until Clerk verifies the session.
  if (isLoaded && isSignedIn) return <SignedInGame key={userId} />;
  return <Redirect to="/sign-in" />;
}

function SignInEntry() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  // Keep the actual sign-in form visible while an unverified session is checked.
  if (isLoaded && isSignedIn) return <SignedInGame key={userId} />;
  return <SignInPage />;
}

function Routes() {
  const [, setLocation] = useLocation();
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
      <AuthInitialization>
        <Switch>
          <Route path="/" component={AccountGameEntry} />
          <Route path="/sign-in/*?" component={SignInEntry} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route component={PublicLanding} />
        </Switch>
      </AuthInitialization>
    </ClerkProvider>
  );
}

function App() {
  if (!clerkPubKey) {
    throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY.");
  }
  return (
    <WouterRouter base={basePath}>
      <Routes />
    </WouterRouter>
  );
}

export default App;
