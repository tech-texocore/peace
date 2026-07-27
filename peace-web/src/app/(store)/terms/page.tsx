import { getSiteConfig } from "@/lib/site-config-server";
import { PolicyPage } from "@/components/store/policy-page";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const config = await getSiteConfig();
  const brand = config.brand.name;

  return (
    <PolicyPage
      title="Terms of Service"
      updated="July 2026"
      intro={`By using ${brand}, you agree to these terms. Please read them carefully.`}
      sections={[
        { heading: "Using the store", body: <p>You must provide accurate account information and use the store lawfully. You’re responsible for activity under your account. We may suspend accounts involved in fraud or abuse.</p> },
        { heading: "Orders & pricing", body: <p>All prices are in INR and inclusive of applicable taxes unless stated otherwise. We may correct pricing errors and cancel affected orders with a full refund. An order is confirmed only after successful payment (or COD confirmation).</p> },
        { heading: "Products", body: <p>We aim to show accurate colours and details, but slight variation is natural for handcrafted and textile products. Availability is subject to stock at the time of dispatch.</p> },
        { heading: "Payments", body: <p>Payments are processed by our secure payment partner. We do not store your full card or UPI credentials. Cash on Delivery may be limited on certain orders.</p> },
        { heading: "Shipping & returns", body: <p>Delivery, returns and refunds are governed by our <a href="/shipping" className="text-accent hover:underline">Shipping</a> and <a href="/returns" className="text-accent hover:underline">Returns</a> policies.</p> },
        { heading: "Liability", body: <p>To the extent permitted by law, our liability for any order is limited to the amount paid for that order. We are not liable for indirect or consequential losses.</p> },
        { heading: "Changes", body: <p>We may update these terms from time to time. Continued use of the store means you accept the updated terms.</p> },
      ]}
    />
  );
}
