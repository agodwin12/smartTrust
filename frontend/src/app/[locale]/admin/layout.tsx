import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { PageShell } from "@/components/layout/PageShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell>
      <AdminShell>{children}</AdminShell>
    </PageShell>
  );
}
