import { AuthProvider } from "@/context/auth-context";
import { SiteConfigProvider } from "@/context/site-config-context";
import { CartProvider } from "@/lib/cart";
import { WishlistProvider } from "@/lib/wishlist";
import { AnnouncementBar } from "@/components/home/announcement-bar";
import { Header } from "@/components/layout/header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getSiteConfig } from "@/lib/site-config-server";
import { DEFAULT_THEME } from "@/lib/site-config";

// Only allow hex / rgb(a) values into the injected stylesheet.
const safeColor = (v: string | undefined, fallback: string) =>
  /^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s%]+\))$/.test(v?.trim() ?? "") ? (v as string).trim() : fallback;

export default async function StoreLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const config = await getSiteConfig();
  const showAnnouncement = config.visibility?.announcement !== false;

  const c = config.theme?.colors ?? DEFAULT_THEME.colors;
  const d = DEFAULT_THEME.colors;
  const themeCss = `:root{--accent:${safeColor(c.accent, d.accent)};--accent-foreground:${safeColor(c.accentForeground, d.accentForeground)};--accent-soft:${safeColor(c.accentSoft, d.accentSoft)};}`;

  return (
    <SiteConfigProvider config={config}>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <style dangerouslySetInnerHTML={{ __html: themeCss }} />
            {showAnnouncement && <AnnouncementBar config={config} />}
            <Header config={config} />
            <main className="flex-1">{children}</main>
            <SiteFooter config={config} />
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </SiteConfigProvider>
  );
}
