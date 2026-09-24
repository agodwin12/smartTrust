import type { ReactNode } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { SellerShell } from "@/components/seller/SellerShell";

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell>
      <SellerShell>{children}</SellerShell>
    </PageShell>
  );
}
