"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export type FaqItem = { question: string; answer: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <Accordion className="divide-y divide-border rounded-2xl border border-border bg-surface px-4 sm:px-6">
      {items.map((item, i) => (
        <AccordionItem key={i} value={String(i)}>
          <AccordionTrigger className="py-4 text-left font-sans text-base font-semibold text-foreground hover:no-underline">{item.question}</AccordionTrigger>
          <AccordionContent className="pb-5 text-sm leading-relaxed text-foreground-secondary">{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
