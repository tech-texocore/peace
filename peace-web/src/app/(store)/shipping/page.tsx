import { getStoreShipping } from "@/lib/storefront-server";
import { getSiteConfig } from "@/lib/site-config-server";
import { PolicyPage } from "@/components/store/policy-page";

export const dynamic = "force-dynamic";
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default async function ShippingPage() {
  const [ship, config] = await Promise.all([getStoreShipping(), getSiteConfig()]);
  const brand = config.brand.name;

  return (
    <PolicyPage
      title="Shipping Policy"
      updated="July 2026"
      intro={`How ${brand} packs, dispatches and delivers your order across India.`}
      sections={[
        {
          heading: "Delivery options & charges",
          body: ship.methods.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {ship.methods.map((m) => (
                <li key={m.key}><span className="font-medium text-ink">{m.label}</span> — {m.days} business day{m.days === 1 ? "" : "s"}, {m.fee === 0 ? "free" : inr(m.fee)}</li>
              ))}
              {ship.freeShippingThreshold > 0 && <li><span className="font-medium text-ink">Free shipping</span> on all orders over {inr(ship.freeShippingThreshold)}.</li>}
            </ul>
          ) : <p>Delivery charges are shown at checkout based on your address.</p>,
        },
        { heading: "Dispatch & processing", body: <p>Orders are processed within 1–2 business days. You’ll receive an order confirmation, and tracking details once your parcel is dispatched.</p> },
        { heading: "Serviceable areas", body: <p>We deliver across India. Enter your PIN code at checkout to confirm serviceability and the estimated delivery date for your area.</p> },
        { heading: "Cash on Delivery", body: <p>{ship.codEnabled ? "Cash on Delivery is available on eligible orders. Any applicable COD handling fee is shown at checkout." : "Cash on Delivery is currently unavailable; please use online payment at checkout."}</p> },
        { heading: "Delays", body: <p>Deliveries may occasionally be delayed by weather, regional restrictions or courier factors. We’ll keep you updated over your registered contact channels.</p> },
      ]}
    />
  );
}
