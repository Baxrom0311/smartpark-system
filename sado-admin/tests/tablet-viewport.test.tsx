/**
 * Tablet viewport tests (M57).
 *
 * Closes the M50 acceptance gap by explicitly verifying the layout
 * shell renders correctly at a 768px tablet viewport. Tailwind's
 * default breakpoints are `sm:640px`, `md:768px`, `lg:1024px`. At
 * 768px we want:
 *
 *   - The mobile-menu toggle in `<Header>` to remain rendered
 *     (it carries `lg:hidden`, so it must be visible below `lg`).
 *   - The mobile close-button inside `<Sidebar>` to be present.
 *   - The sidebar `<aside>` to carry the off-canvas translate classes
 *     (no `lg:translate-x-0`/`lg:static` short-circuit at this width).
 *   - Backdrop click + `setSidebarOpen(false)` to collapse the
 *     overlay so it no longer captures pointer events.
 *   - Header's mobile-toggle to flip the `sidebarOpen` flag in the
 *     UI store, mirroring what a tablet user does in production.
 *
 * jsdom does not actually evaluate viewport-aware Tailwind classes,
 * so we mirror the contract by (a) wiring a `matchMedia` mock that
 * answers `(min-width: 768px)` truthy + `(min-width: 1024px)` falsy,
 * and (b) asserting on the className contract that Tailwind compiles
 * for these breakpoints. If the markup ever drops `lg:hidden` from
 * the menu button — which would silently break the tablet layout in
 * production — these assertions fail.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "uz", changeLanguage: () => Promise.resolve() },
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    activeProps: _activeProps,
    activeOptions: _activeOptions,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    activeProps?: unknown;
    activeOptions?: unknown;
    [key: string]: unknown;
  }) => (
    <a href={to} {...(rest as Record<string, unknown>)}>
      {children}
    </a>
  ),
  useNavigate: () => () => undefined,
}));

vi.mock("@/hooks/queries/use-notifications", () => ({
  useUnreadNotificationCount: () => ({ data: { unread: 0 } }),
}));

vi.mock("@/components/layout/notifications-bell", () => ({
  NotificationsBell: () => <div data-testid="bell" />,
}));

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";

/** Tablet (768px) viewport — between Tailwind's `sm` and `lg`. */
const TABLET_WIDTH = 768;

interface MQList {
  matches: boolean;
  media: string;
  onchange: null;
  addEventListener: () => void;
  removeEventListener: () => void;
  addListener: () => void;
  removeListener: () => void;
  dispatchEvent: () => boolean;
}

function makeMatchMedia(width: number) {
  return (query: string): MQList => {
    // Parse a numeric `(min-width: NNNpx)` / `(max-width: NNNpx)` from
    // the query. Anything else (e.g. `prefers-color-scheme`) defaults
    // to false so the dark-mode branch keeps deterministic behaviour.
    const minMatch = /\(min-width:\s*(\d+)px\)/i.exec(query);
    const maxMatch = /\(max-width:\s*(\d+)px\)/i.exec(query);
    let matches = false;
    if (minMatch && minMatch[1]) {
      matches = width >= Number.parseInt(minMatch[1], 10);
    } else if (maxMatch && maxMatch[1]) {
      matches = width <= Number.parseInt(maxMatch[1], 10);
    }
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    };
  };
}

describe("tablet viewport (768px)", () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalInnerWidth: number;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: makeMatchMedia(TABLET_WIDTH),
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: TABLET_WIDTH,
    });
    // Reset the UI store so each test starts with a known sidebar state.
    useUiStore.setState({ theme: "system", sidebarOpen: true });
    // Provide a fully-authenticated user so the header's user-block renders.
    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "u-1",
        role: "admin",
        email: "admin@sado.test",
        phone: null,
        full_name: "Tablet Tester",
        language: "uz",
        is_active: true,
        is_verified: true,
        region_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      tokens: {
        accessToken: "tok",
        refreshToken: "rtok",
        expiresAt: Date.now() + 60_000,
      },
      error: null,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
    // beforeEach resets sidebarOpen for the next test; calling
    // setState here would re-render any still-mounted component
    // after Testing Library's cleanup fires and trigger an act warning.
  });

  it("matchMedia answers tablet-width queries correctly", () => {
    expect(window.matchMedia("(min-width: 640px)").matches).toBe(true);
    expect(window.matchMedia("(min-width: 768px)").matches).toBe(true);
    expect(window.matchMedia("(min-width: 1024px)").matches).toBe(false);
    expect(window.matchMedia("(max-width: 1023px)").matches).toBe(true);
  });

  it("renders the off-canvas mobile toggle in the header", () => {
    render(<Header />);
    const menuToggle = screen.getByRole("button", {
      name: /toggle navigation/i,
    });
    expect(menuToggle).toBeInTheDocument();
    // The `lg:hidden` class is what hides this on desktops; the entire
    // tablet shell hinges on it, so we assert directly on the contract.
    expect(menuToggle.className).toMatch(/\blg:hidden\b/);
  });

  it("preserves user info at tablet width (sm:flex contract)", () => {
    render(<Header />);
    // The user details block uses `hidden ... sm:flex`, so at 768px it
    // remains visible. We probe via the role/email text the block renders.
    expect(screen.getByText("Tablet Tester")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("renders sidebar with off-canvas classes (no lg:static at tablet)", () => {
    render(<Sidebar />);
    const aside = screen.getByRole("complementary", {
      name: /primary navigation/i,
    });
    // Off-canvas behaviour relies on `fixed` + translate classes, with
    // `lg:static lg:translate-x-0` only kicking in above lg.
    expect(aside.className).toMatch(/\bfixed\b/);
    expect(aside.className).toMatch(/lg:static/);
    expect(aside.className).toMatch(/lg:translate-x-0/);
    // Sidebar starts open after our beforeEach, so translate-x-0 is on.
    expect(aside.className).toMatch(/translate-x-0/);
  });

  it("sidebar close-button is rendered with lg:hidden", () => {
    render(<Sidebar />);
    const closeBtn = screen.getByRole("button", {
      name: /close navigation/i,
    });
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn.className).toMatch(/\blg:hidden\b/);
  });

  it("backdrop click collapses the sidebar", async () => {
    const user = userEvent.setup();
    const { container } = render(<Sidebar />);
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    // The backdrop is the first hidden div with the lg:hidden class.
    const backdrop = container.querySelector(
      'div[aria-hidden="true"].lg\\:hidden',
    );
    expect(backdrop).not.toBeNull();
    if (backdrop) {
      await user.click(backdrop);
    }
    expect(useUiStore.getState().sidebarOpen).toBe(false);
    // Aside slides off-canvas.
    const aside = screen.getByRole("complementary");
    expect(aside.className).toMatch(/-translate-x-full/);
  });

  it("header menu button toggles sidebarOpen state", async () => {
    const user = userEvent.setup();
    render(<Header />);
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    const toggle = screen.getByRole("button", { name: /toggle navigation/i });
    await user.click(toggle);
    expect(useUiStore.getState().sidebarOpen).toBe(false);
    await user.click(toggle);
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });

  it("layout responds when sidebar is closed externally", () => {
    render(<Sidebar />);
    act(() => {
      useUiStore.getState().setSidebarOpen(false);
    });
    const aside = screen.getByRole("complementary");
    const tokens = aside.className.split(/\s+/);
    expect(tokens).toContain("-translate-x-full");
    // The unprefixed `translate-x-0` should be absent — only the
    // `lg:translate-x-0` desktop variant may remain.
    expect(tokens).not.toContain("translate-x-0");
  });
});
