import { getSiteConfig } from "@/lib/site-config-server";
import { PolicyPage } from "@/components/store/policy-page";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const config = await getSiteConfig();
  const brand = config.brand.name;

  return (
    <PolicyPage
      title="Returns & Exchange"
      updated="July 2026"
      intro={`We want you to love what you receive. If something isn’t right, ${brand} offers easy returns and exchanges.`}
      sections={[
        { heading: "Return window", body: <p>Most items can be returned within <span className="font-medium text-ink">7 days</span> of delivery. The exact window is shown on each product page, as some sellers or items may differ.</p> },
        { heading: "Eligibility", body: <p>Items must be unused, unwashed and in their original condition with tags and packaging intact. Customised, made-to-order and fabric-cut-by-the-metre items are non-returnable unless they arrive damaged or defective.</p> },
        { heading: "How to return", body: <p>Go to <span className="font-medium text-ink">Account → Orders</span>, open the order and raise a return request. Once approved, a pickup is arranged or you’ll receive return instructions.</p> },
        { heading: "Refunds", body: <p>After the returned item passes a quick quality check, your refund is issued to the original payment method (or as store credit for COD orders) within 5–7 business days.</p> },
        { heading: "Exchanges", body: <p>Prefer a different size or colour? Raise an exchange from your order — subject to availability. If the replacement is unavailable, we’ll process a refund instead.</p> },
      ]}
    />
  );
}
