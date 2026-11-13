"use client";

import * as React from "react";

// -- Types ---------------------------------------------------------------------
interface BeaconPayload {
  sessionId: string;
  event: string;
  payload?: Record<string, unknown>;
}

// -- Constants -----------------------------------------------------------------
const SESSION_KEY = "sjb_sid";
const FIRED_KEY = "sjb_fired";

// Section ids observed for section_view (fires once each at 50 percent).
const SECTIONS = ["experience", "projects", "skills", "education", "resume", "now", "contact"];

// engaged needs the page visible for this long first.
const ENGAGED_VISIBLE_MS = 5000;
const ENGAGED_SCROLL_PCT = 25;
// Scroll position is sampled at most this often; the scroll listener itself only schedules.
const SCROLL_SAMPLE_MS = 250;

// -- Fire-and-forget beacon send -----------------------------------------------
// Never throws. All analytics failures are silent.
function send(data: BeaconPayload, unload = false): void {
  try {
    const body = JSON.stringify(data);
    if (unload && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/beacon", new Blob([body], { type: "application/json" }));
      return;
    }
    fetch("/api/beacon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

// -- Session ID resolution -----------------------------------------------------
// Priority: URL __sid param (set by /v/[key] redirect) > existing sessionStorage > new UUID.
// The key is never sent: the beacon route takes it from the session's visit_server row.
function resolveSessionId(): string {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSid = urlParams.get("__sid");
    if (urlSid) {
      sessionStorage.setItem(SESSION_KEY, urlSid);
      urlParams.delete("__sid");
      urlParams.delete("__key");
      const newUrl =
        window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "") + window.location.hash;
      window.history.replaceState(null, "", newUrl);
      return urlSid;
    }
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const newId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, newId);
    return newId;
  } catch {
    return crypto.randomUUID();
  }
}

// -- Once-per-session bookkeeping ----------------------------------------------
// Stored in sessionStorage so a reload inside the same session does not repeat
// an event; a throwaway Set when storage is unavailable.
function loadFired(sessionId: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(FIRED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { sid: string; fired: string[] };
      if (parsed.sid === sessionId) return new Set(parsed.fired);
    }
  } catch {}
  return new Set();
}

function saveFired(sessionId: string, fired: Set<string>): void {
  try {
    sessionStorage.setItem(FIRED_KEY, JSON.stringify({ sid: sessionId, fired: [...fired] }));
  } catch {}
}

function scrollPercent(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100)));
}

/** Which outbound target an anchor is, or null. */
function outboundTarget(href: string): "github" | "linkedin" | "email" | null {
  if (href.startsWith("mailto:")) return "email";
  try {
    const host = new URL(href, window.location.href).hostname;
    if (host === "github.com" || host.endsWith(".github.com")) return "github";
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
  } catch {}
  return null;
}

/** A same-origin PDF link is the resume. */
function isResumeLink(a: HTMLAnchorElement): boolean {
  try {
    const u = new URL(a.href, window.location.href);
    return u.origin === window.location.origin && u.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

// -- Main component ------------------------------------------------------------
export function AnalyticsBeacon() {
  React.useEffect(() => {
    const sessionId = resolveSessionId();
    const fired = loadFired(sessionId);

    // Emits an event once per session for the given dedupe id.
    const once = (id: string, event: string, payload?: Record<string, unknown>) => {
      if (fired.has(id)) return;
      fired.add(id);
      saveFired(sessionId, fired);
      send({ sessionId, event, payload });
    };

    // -- visit_confirmed: once per session, drives has_js on the server --------
    once("visit_confirmed", "visit_confirmed");

    // -- Visibility clock and scroll depth -------------------------------------
    let visibleSince = document.visibilityState === "visible" ? Date.now() : null;
    let visibleAcc = 0;
    const visibleMs = () => visibleAcc + (visibleSince !== null ? Date.now() - visibleSince : 0);
    let maxScroll = 0;
    let interacted = false;
    let engagedTimer: ReturnType<typeof setTimeout> | null = null;

    const tryEngaged = () => {
      if (fired.has("engaged")) return;
      if (!(interacted || maxScroll >= ENGAGED_SCROLL_PCT)) return;
      const remaining = ENGAGED_VISIBLE_MS - visibleMs();
      if (remaining <= 0) {
        once("engaged", "engaged");
      } else if (engagedTimer === null) {
        engagedTimer = setTimeout(() => {
          engagedTimer = null;
          tryEngaged();
        }, remaining + 50);
      }
    };

    const onInteract = () => {
      if (interacted) return;
      interacted = true;
      tryEngaged();
    };

    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const sampleScroll = () => {
      scrollTimer = null;
      const pct = scrollPercent();
      if (pct > maxScroll) {
        maxScroll = pct;
        if (pct >= ENGAGED_SCROLL_PCT) tryEngaged();
      }
    };
    // The listener only schedules a sample; nothing runs per scroll frame.
    const onScroll = () => {
      if (scrollTimer === null) scrollTimer = setTimeout(sampleScroll, SCROLL_SAMPLE_MS);
    };

    // -- dwell: on every hide, may repeat ----------------------------------------
    const sendDwell = () => {
      send({ sessionId, event: "dwell", payload: { visible_ms: visibleMs(), max_scroll_pct: maxScroll } }, true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (visibleSince !== null) {
          visibleAcc += Date.now() - visibleSince;
          visibleSince = null;
        }
        sendDwell();
      } else if (visibleSince === null) {
        visibleSince = Date.now();
        tryEngaged();
      }
    };
    let hidden = false;
    const onPageHide = () => {
      if (hidden) return;
      hidden = true;
      if (document.visibilityState !== "hidden") sendDwell();
    };

    // -- Clicks: resume, project and outbound ----------------------------------
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      const project = a.closest<HTMLElement>("[data-project]")?.dataset.project;
      if (project) {
        once(`project:${project}`, "project_click", { project });
        return;
      }
      if (isResumeLink(a)) {
        const event = a.hasAttribute("download") ? "resume_download" : "resume_open";
        once(event, event);
        return;
      }
      const target = outboundTarget(href);
      if (target) once(`outbound:${target}`, "outbound_click", { target });
    };

    // -- Observers and listeners, registered after first paint -----------------
    let observer: IntersectionObserver | null = null;
    let registered = false;
    const register = () => {
      registered = true;
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("pointerdown", onInteract, { passive: true });
      window.addEventListener("keydown", onInteract, { passive: true });
      document.addEventListener("click", onClick);
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("pagehide", onPageHide);

      if ("IntersectionObserver" in window) {
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const id = entry.target.id;
              if (!id || !entry.isIntersecting) continue;
              // Half the section, or a section filling half the viewport (tall sections never reach 0.5).
              const viewport = entry.rootBounds?.height ?? window.innerHeight;
              if (entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= viewport * 0.5) {
                once(`section:${id}`, "section_view", { section: id });
                observer?.unobserve(entry.target);
              }
            }
          },
          { threshold: [0.1, 0.25, 0.5] }
        );
        for (const id of SECTIONS) {
          if (fired.has(`section:${id}`)) continue;
          const el = document.getElementById(id);
          if (el) observer.observe(el);
        }
      }
      sampleScroll();
    };

    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
    const cancelIdle = window.cancelIdleCallback ?? ((h: number) => clearTimeout(h));
    const idleHandle = idle(register);

    return () => {
      cancelIdle(idleHandle);
      if (engagedTimer !== null) clearTimeout(engagedTimer);
      if (scrollTimer !== null) clearTimeout(scrollTimer);
      if (!registered) return;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      document.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      observer?.disconnect();
    };
  }, []);

  return null;
}
