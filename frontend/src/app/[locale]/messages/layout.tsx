import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ChatShell } from "@/components/chat/ChatShell";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";

/** Every /messages page: sign-in gate, then inbox + conversation. */
export default function MessagesLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell>
      <RequireAuth>
        <Container className="py-5 sm:py-8">
          <ChatShell>{children}</ChatShell>
        </Container>
      </RequireAuth>
    </PageShell>
  );
}
