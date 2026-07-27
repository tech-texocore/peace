import { AdminAuthProvider } from "@/lib/admin/auth-context";
import { AdminShell } from "@/components/admin/shell";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
