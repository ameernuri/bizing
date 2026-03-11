"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  FlaskConical,
  LogOut,
  Shield,
  Store,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const getStartedButtonRef = useRef<HTMLButtonElement | null>(null);
  const [showHeaderSignIn, setShowHeaderSignIn] = useState(false);
  const [pageReady, setPageReady] = useState(false);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => setPageReady(true));
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    if (isLoading || isAuthenticated) return;

    const updateHeaderSignInVisibility = () => {
      const ctaButton = getStartedButtonRef.current;
      if (!ctaButton) {
        setShowHeaderSignIn(false);
        return;
      }
      const rect = ctaButton.getBoundingClientRect();
      const ctaTop = rect.top + window.scrollY;
      const ctaBottom = rect.bottom + window.scrollY;
      // Reveal a bit before the hero CTA fully leaves view.
      setShowHeaderSignIn(window.scrollY > Math.min(ctaBottom, ctaTop - 96));
    };

    const rafId = window.requestAnimationFrame(updateHeaderSignInVisibility);
    window.addEventListener("scroll", updateHeaderSignInVisibility, {
      passive: true,
    });
    window.addEventListener("resize", updateHeaderSignInVisibility);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", updateHeaderSignInVisibility);
      window.removeEventListener("resize", updateHeaderSignInVisibility);
    };
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-6 min-h-screen text-sm bg-slate-50 text-slate-600">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white text-slate-900 selection:bg-slate-900 selection:text-white">
        <header className="fixed inset-x-0 top-0 z-40 border-b backdrop-blur-sm border-slate-200/90 bg-white/95">
          <div className="flex justify-between items-center px-6 py-4 mx-auto w-full max-w-7xl md:px-10">
            <div>
              <img
                src="/images/bizing.logo.horizontal.combo.svg"
                alt="Bizing"
                className="w-auto h-9 md:h-11"
              />
            </div>
            <div
              className={[
                "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                showHeaderSignIn
                  ? "translate-y-0 opacity-100"
                  : "-translate-y-1.5 opacity-0 pointer-events-none",
              ].join(" ")}
            >
              <Link href="/sign-in">
                <Button
                  variant="outline"
                  className="h-9 border-slate-200 bg-white text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                >
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <div className="px-6 pt-24 pb-8 mx-auto w-full max-w-7xl md:px-10 md:pb-10 md:pt-28">
          <main className="mt-14 md:mt-16">
            <section className="py-12 border-b border-slate-200 md:py-16">
              <div
                className={[
                  "max-w-4xl space-y-8 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  pageReady ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                ].join(" ")}
              >
                <h1 className="text-[2.9rem] font-semibold leading-[1.02] tracking-tight md:text-[4.9rem]">
                  <span className="block bg-[linear-gradient(180deg,#0f172a_0%,#334155_100%)] bg-clip-text text-transparent">
                    launch your biz.
                  </span>
                  <span className="block bg-[linear-gradient(180deg,#0f172a_0%,#334155_100%)] bg-clip-text text-transparent">
                    grow without friction.
                  </span>
                  <span className="block bg-[linear-gradient(180deg,#0f172a_0%,#475569_100%)] bg-clip-text text-transparent">
                    automate like a pro.
                  </span>
                </h1>
                <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
                  From your first sale to multi-team scale, Bizing keeps work,
                  customers, and payments connected and flowing.
                </p>
                <div className="flex flex-wrap gap-4 items-center">
                  <Link href="/sign-in?mode=sign_up&next=/owner">
                    <Button
                      ref={getStartedButtonRef}
                      className="h-11 bg-slate-900 px-6 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-800 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)]"
                    >
                      Get Started
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                  <span className="text-sm text-slate-600">
                    or{" "}
                    <Link
                      href="/sign-in"
                      className="font-medium text-slate-900 transition-colors duration-200 underline-offset-4 hover:text-slate-700 hover:underline"
                    >
                      sign in here.
                    </Link>
                  </span>
                </div>
              </div>
            </section>

            <section className="py-12 md:py-16">
              <div className="mb-7 md:mb-9">
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                  Built to grow with you
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600">
                  Start with a clear operating base, then grow into deeper
                  operations without rebuilding what already works.
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fcfcfd_100%)] transition-colors duration-300 hover:border-slate-300">
                <div className="grid lg:grid-cols-3">
                  <article className="border-b border-slate-200 p-7 transition-colors duration-200 hover:bg-slate-50/60 lg:border-b-0 lg:border-r">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Start
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                      Get running quickly
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Launch quickly with a clear setup path across services and
                      products.
                    </p>
                    <div className="mt-5 space-y-2 text-sm text-slate-700">
                      <p>Set up your business</p>
                      <p>Define your schedule</p>
                      <p>Capture your first sale</p>
                    </div>
                  </article>

                  <article className="border-b border-slate-200 p-7 transition-colors duration-200 hover:bg-slate-50/60 lg:border-b-0 lg:border-r">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Scale
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                      Scale with consistency
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Expand team members, locations, and offers while keeping
                      one operating model.
                    </p>
                    <div className="mt-5 space-y-2 text-sm text-slate-700">
                      <p>Add staff and permissions</p>
                      <p>Grow services and products</p>
                      <p>Keep reporting in one view</p>
                    </div>
                  </article>

                  <article className="p-7 transition-colors duration-200 hover:bg-slate-50/60">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Automate
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                      Automate at every step
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Introduce workflows and agent-ready actions across daily
                      operations without losing control.
                    </p>
                    <div className="mt-5 space-y-2 text-sm text-slate-700">
                      <p>Workflow at every stage</p>
                      <p>Agent-first when you need it</p>
                      <p>Human approvals keep you in control</p>
                    </div>
                  </article>
                </div>
              </div>
            </section>

            <section className="py-12 border-t border-slate-200 md:py-14">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Operations stay connected
              </h2>
              <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">
                Bizing keeps setup, selling, scheduling, communication, and
                payments aligned in one operating flow from day one through
                scale.
              </p>
              <p className="mt-2 max-w-4xl text-base leading-8 text-slate-600">
                Teams can keep moving in one surface instead of splitting work
                across disconnected tools.
              </p>
            </section>

            <section className="py-12 border-t border-slate-200 md:py-14">
              <div className="grid gap-8 lg:grid-cols-[1.2fr,1fr]">
                <article>
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                    Automation stays in control
                  </h2>
                  <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
                    As volume grows, add workflows and agent-ready actions at
                    the pace your team can absorb, without losing oversight.
                  </p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfc_100%)] p-6 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50/60 md:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    How it scales
                  </p>
                  <div className="mt-4 space-y-5 text-sm leading-7 text-slate-600">
                    <p>Workflows for repeatable steps</p>
                    <p>Agent-ready actions where speed helps</p>
                    <p>Human approvals where judgment matters</p>
                  </div>
                </article>
              </div>
            </section>

            <section className="py-12 border-t border-slate-200 md:py-16">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-8 md:p-12">
                <div className="grid gap-8 items-center lg:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Start here
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                      Set the business up once, then keep moving.
                    </h2>
                    <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
                      Open your account, shape the way you work, and let Bizing carry the day-to-day flow forward with you.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-6 items-center">
                      <Link href="/sign-in?mode=sign_up&next=/owner">
                        <Button className="h-12 bg-slate-900 px-8 text-base font-semibold text-white transition-all duration-200 hover:bg-slate-800 hover:shadow-[0_8px_24px_rgba(15,23,42,0.14)]">
                          Start Bizing
                          <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                      </Link>
                      <p className="text-sm text-slate-500">
                        Start simple, keep the core clean, and add more depth only when the business needs it.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-start lg:justify-end">
                    <img
                      src="/images/bizing.logo.icon.svg"
                      alt="Bizing icon"
                      className="h-20 w-20 opacity-90 md:h-28 md:w-28"
                    />
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="px-6 py-10 mx-auto space-y-6 w-full max-w-6xl">
        <header className="flex flex-wrap gap-3 justify-between items-center px-4 py-3 bg-white rounded-xl border shadow-sm border-slate-200">
          <div className="flex gap-3 items-center">
            <img
              src="/images/bizing.logo.horizontal.combo.svg"
              alt="Bizing"
              className="w-auto h-7"
            />
            <p className="text-sm text-slate-600">
              Signed in as {user?.name ?? user?.email ?? "user"}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Link href="/owner">
              <Button className="text-white bg-slate-900 hover:bg-slate-800">
                Open dashboard
              </Button>
            </Link>
            <Button variant="outline" onClick={() => void signOut()}>
              <LogOut className="mr-2 w-4 h-4" />
              Sign out
            </Button>
          </div>
        </header>

        <div className="grid gap-4">
          <Link href="/owner">
            <Card className="h-full bg-white transition border-slate-200 hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex gap-2 items-center text-base">
                  <Store className="w-4 h-4" />
                  Business dashboard
                </CardTitle>
                <CardDescription>
                  Services, availability, payments, communication, and
                  reporting.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {user?.role === "admin" ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/dev/lab">
              <Card className="h-full bg-white transition border-slate-200 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex gap-2 items-center text-base">
                    <Wrench className="w-4 h-4" />
                    Admin lab
                  </CardTitle>
                  <CardDescription>
                    Internal diagnostics and UX controls.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/ooda">
              <Card className="h-full bg-white transition border-slate-200 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex gap-2 items-center text-base">
                    <FlaskConical className="w-4 h-4" />
                    OODash
                  </CardTitle>
                  <CardDescription>Use cases and saga runs.</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/schema">
              <Card className="h-full bg-white transition border-slate-200 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex gap-2 items-center text-base">
                    <Shield className="w-4 h-4" />
                    Schema explorer
                  </CardTitle>
                  <CardDescription>Data model explorer.</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
