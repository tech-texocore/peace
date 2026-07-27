import { getSiteConfig } from "@/lib/site-config-server";
import { PolicyPage } from "@/components/store/policy-page";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const config = await getSiteConfig();
  const brand = config.brand.name;

  return (
    <PolicyPage
      title="Privacy Policy"
      updated="July 2026"
      intro={`${brand} respects your privacy. This policy explains what we collect, why, and the choices you have.`}
      sections={[
        { heading: "Information we collect", body: <p>Account details (name, email, phone), delivery addresses, order and payment metadata, and usage data such as pages viewed and items saved. We do not store full card details — payments are handled securely by our payment partner.</p> },
        { heading: "How we use it", body: <p>To process and deliver orders, provide support, send order and account updates, prevent fraud, and — with your consent — share offers. You can opt out of marketing at any time from your profile.</p> },
        { heading: "Sharing", body: <p>We share data only as needed with logistics, payment and communication partners to fulfil your order, and when required by law. We never sell your personal data.</p> },
        { heading: "Cookies", body: <p>We use essential cookies to keep you signed in and remember your cart, and optional analytics cookies to improve the store. You can manage cookies in your browser settings.</p> },
        { heading: "Your rights", body: <p>You may access, correct or delete your data, and request account deletion, by contacting us. We retain data only as long as necessary for legal and operational purposes.</p> },
        { heading: "Contact", body: <p>Questions about privacy? Reach us through our <a href="/contact" className="text-accent hover:underline">Contact</a> page.</p> },
      ]}
    />
  );
}
