// The neutral storefront config a NEW store starts with. No demo/sample content —
// products, promos, coupons and category showcases are added by the store owner
// (admin) or by the demo seed (scripts/seed.js). Shape matches what the web app
// consumes (peace-web/src/lib/site-config.ts). Stored as JSON.
export function defaultSiteConfig(storeName = 'Peace') {
  return {
    brand: {
      name: storeName,
      tagline: 'Thoughtfully made, calmly delivered to your door.',
    },
    announcements: [
      'Free shipping on orders over ₹999',
      'Easy 7-day returns',
      'Cash on delivery available',
    ],
    marquee: [
      'Free shipping over ₹999',
      'Easy 7-day returns',
      'New arrivals every week',
    ],
    nav: [
      { label: 'Shop', href: '/products' },
      { label: 'Offers', href: '/offers' },
      { label: 'About', href: '/about' },
    ],
    hero: {
      eyebrow: 'Welcome',
      titleLead: 'Everyday essentials,',
      titleEmphasis: 'thoughtfully',
      titleTail: 'made.',
      subtitle:
        'Browse freely — sign in only when you are ready to check out.',
      primaryCta: { label: 'Shop the collection', href: '/products' },
      secondaryCta: { label: 'View offers', href: '/offers' },
      ratingText: '',
      featuredProductSlug: '',
    },
    sections: {
      categories: { eyebrow: 'Browse', title: 'Shop by category' },
      bestSellers: { eyebrow: 'Trending', title: 'Best sellers', description: 'The pieces our customers keep coming back for.' },
      newArrivals: { eyebrow: 'Just in', title: 'New arrivals', description: 'Freshly added this week.' },
      offers: { eyebrow: 'Save more', title: 'Offers & coupons', description: 'Apply these at checkout.' },
      testimonials: { eyebrow: 'Reviews', title: 'Loved by customers' },
    },
    categories: [],
    valueProps: [
      { icon: 'shipping', title: 'Free shipping', text: 'On all orders over ₹999' },
      { icon: 'returns', title: 'Easy returns', text: '7-day hassle-free returns' },
      { icon: 'secure', title: 'Secure payment', text: '100% protected checkout' },
      { icon: 'support', title: '24/7 support', text: "We're here to help anytime" },
    ],
    promos: [],
    coupons: [],
    testimonials: [],
    newsletter: {
      eyebrow: 'Join the list',
      title: 'Join the list',
      subtitle: 'Subscribe for new arrivals, private offers and a little calm in your inbox.',
      placeholder: 'Enter your email',
      cta: 'Subscribe',
    },
    footer: {
      groups: [
        { title: 'Shop', links: [
          { label: 'Shop all', href: '/products' },
          { label: 'Offers', href: '/offers' },
        ] },
        { title: 'Support', links: [
          { label: 'Shipping', href: '/shipping' },
          { label: 'Returns', href: '/returns' },
          { label: 'Track Order', href: '/track' },
          { label: 'Contact', href: '/contact' },
        ] },
        { title: 'Company', links: [
          { label: 'About', href: '/about' },
          { label: 'Journal', href: '/journal' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'Terms', href: '/terms' },
        ] },
      ],
      note: 'Made with care.',
    },
    currency: '₹',
    theme: {
      colors: {
        accent: '#3c5341',
        accentForeground: '#f6f3ec',
        accentSoft: '#e7ece2',
      },
    },
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
}
