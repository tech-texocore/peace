import { env } from "@/lib/config/env";

/**
 * Site configuration — the single source of truth for all storefront content
 * and branding. Today it is a static object; it is shaped so it can later be
 * served from the super-admin / backend without changing any component.
 *
 * Rules that keep it backend-ready:
 *  - Everything here is plain, serialisable data (no React components).
 *  - Icons are referenced by string key (see icon registry in components).
 */

export interface NavItem {
  label: string;
  href: string;
}

export interface Category {
  name: string;
  count: string;
  href: string;
  featured?: boolean;
}

export interface ValueProp {
  icon: "shipping" | "returns" | "secure" | "support";
  title: string;
  text: string;
}

export interface Promo {
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  image?: string;
}

export interface Coupon {
  code: string;
  label: string;
  note: string;
}

export interface Testimonial {
  name: string;
  location: string;
  quote: string;
}

export interface SiteConfig {
  brand: { name: string; tagline: string };
  announcements: string[];
  marquee: string[];
  nav: NavItem[];
  hero: {
    eyebrow: string;
    titleLead: string;
    titleEmphasis: string;
    titleTail: string;
    subtitle: string;
    primaryCta: NavItem;
    secondaryCta: NavItem;
    ratingText: string;
    featuredProductSlug?: string;
  };
  sections: {
    categories: { eyebrow: string; title: string };
    bestSellers: { eyebrow: string; title: string; description: string };
    newArrivals: { eyebrow: string; title: string; description: string };
    offers: { eyebrow: string; title: string; description: string };
    testimonials: { eyebrow: string; title: string };
  };
  categories: Category[];
  valueProps: ValueProp[];
  promos: Promo[];
  coupons: Coupon[];
  testimonials: Testimonial[];
  newsletter: {
    eyebrow: string;
    title: string;
    subtitle: string;
    placeholder: string;
    cta: string;
  };
  footer: {
    groups: { title: string; links: NavItem[] }[];
    note: string;
  };
  currency: string;
  theme: ThemeConfig;
  // Per-section storefront visibility. Missing key = visible.
  visibility: Record<string, boolean>;
}

export interface ThemeConfig {
  colors: {
    accent: string;
    accentForeground: string;
    accentSoft: string;
  };
}

export const DEFAULT_THEME: ThemeConfig = {
  colors: {
    accent: "#3c5341",
    accentForeground: "#f6f3ec",
    accentSoft: "#e7ece2",
  },
};

export const SECTION_KEYS = [
  "announcement",
  "hero",
  "marquee",
  "valueProps",
  "categories",
  "bestSellers",
  "promos",
  "newArrivals",
  "offers",
  "testimonials",
  "newsletter",
] as const;

export const siteConfig: SiteConfig = {
  brand: {
    name: env.appName,
    tagline: "Considered textiles, thoughtfully woven and calmly delivered to your door.",
  },

  announcements: [
    "Free shipping on orders over ₹999",
    "Easy 7-day returns",
    "Cash on delivery available",
  ],

  marquee: [
    "Freshly restocked",
    "Handwoven in small batches",
    "Carbon-neutral delivery",
    "Loved by 10,000+",
    "New season 2026",
  ],

  nav: [
    { label: "Shop", href: "/products" },
    { label: "Sarees", href: "/collections/sarees" },
    { label: "Fabrics", href: "/collections/fabrics" },
    { label: "Offers", href: "/offers" },
    { label: "About", href: "/about" },
  ],

  hero: {
    eyebrow: "New season · 2026",
    titleLead: "Timeless textiles,",
    titleEmphasis: "gracefully",
    titleTail: "woven.",
    subtitle:
      "Handpicked weaves and considered essentials. Browse freely — sign in only when you are ready to check out.",
    primaryCta: { label: "Shop the collection", href: "/products" },
    secondaryCta: { label: "Explore lookbook", href: "/collections" },
    ratingText: "Loved by 10,000+ customers",
    featuredProductSlug: "",
  },

  sections: {
    categories: { eyebrow: "Browse", title: "Shop by category" },
    bestSellers: {
      eyebrow: "Trending",
      title: "Best sellers",
      description: "The weaves our customers keep coming back for.",
    },
    newArrivals: {
      eyebrow: "Just in",
      title: "New arrivals",
      description: "Freshly added to the collection this week.",
    },
    offers: {
      eyebrow: "Save more",
      title: "Offers & coupons",
      description: "Apply these at checkout. All placeholder codes for now.",
    },
    testimonials: { eyebrow: "Reviews", title: "Loved by customers" },
  },

  categories: [
    { name: "Sarees", count: "120 styles", href: "/collections/sarees", featured: true },
    { name: "Kurtas & Sets", count: "84 styles", href: "/collections/kurtas" },
    { name: "Fabrics by the metre", count: "60 weaves", href: "/collections/fabrics" },
    { name: "Home Linen", count: "45 pieces", href: "/collections/home-linen" },
    { name: "Dupattas & Stoles", count: "38 styles", href: "/collections/dupattas" },
  ],

  valueProps: [
    { icon: "shipping", title: "Free shipping", text: "On all orders over ₹999" },
    { icon: "returns", title: "Easy returns", text: "7-day hassle-free returns" },
    { icon: "secure", title: "Secure payment", text: "100% protected checkout" },
    { icon: "support", title: "24/7 support", text: "We're here to help anytime" },
  ],

  promos: [
    { title: "The Festive Edit", subtitle: "Handwoven for celebrations", cta: "Shop the edit", href: "/collections/festive" },
    { title: "Up to 40% Off", subtitle: "Season-end textile sale", cta: "Shop the sale", href: "/offers" },
  ],

  coupons: [
    { code: "PEACE10", label: "10% off your first order", note: "Min. spend ₹1499" },
    { code: "FREESHIP", label: "Free express shipping", note: "No minimum spend" },
    { code: "WEAVE25", label: "25% off on saree bundles", note: "Selected items only" },
  ],

  testimonials: [
    { name: "Customer name", location: "City", quote: "Placeholder review text — replace with a real customer testimonial once reviews are wired in." },
    { name: "Customer name", location: "City", quote: "Placeholder review text — replace with a real customer testimonial once reviews are wired in." },
    { name: "Customer name", location: "City", quote: "Placeholder review text — replace with a real customer testimonial once reviews are wired in." },
  ],

  newsletter: {
    eyebrow: "Join the list",
    title: "Get 10% off your first order",
    subtitle: "Subscribe for new arrivals, private offers and a little calm in your inbox.",
    placeholder: "Enter your email",
    cta: "Subscribe",
  },

  footer: {
    groups: [
      {
        title: "Shop",
        links: [
          { label: "Sarees", href: "/collections/sarees" },
          { label: "Kurtas & Sets", href: "/collections/kurtas" },
          { label: "Fabrics", href: "/collections/fabrics" },
          { label: "Home Linen", href: "/collections/home-linen" },
        ],
      },
      {
        title: "Support",
        links: [
          { label: "Shipping", href: "/shipping" },
          { label: "Returns", href: "/returns" },
          { label: "Track Order", href: "/track" },
          { label: "Contact", href: "/contact" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About", href: "/about" },
          { label: "Journal", href: "/journal" },
          { label: "Privacy", href: "/privacy" },
          { label: "Terms", href: "/terms" },
        ],
      },
    ],
    note: "Made with care.",
  },

  currency: "₹",

  theme: DEFAULT_THEME,

  visibility: {
    announcement: true,
    hero: true,
    marquee: true,
    valueProps: true,
    categories: true,
    bestSellers: true,
    promos: true,
    newArrivals: true,
    offers: true,
    testimonials: true,
    newsletter: true,
  },
};
