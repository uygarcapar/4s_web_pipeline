import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ServicesSection, SiteConfig } from "@/lib/schema";
import { cn } from "cn";

interface ServicesProps {
  section: ServicesSection;
  config: SiteConfig;
}

/** Services grid; "list" variant renders a single-column list. */
export function Services({ section }: ServicesProps) {
  const isList = section.variant === "list";

  return (
    <section id={section.id} className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="font-heading text-3xl font-semibold text-foreground">
        {section.title ?? "Hizmetlerimiz"}
      </h2>
      <div
        className={cn(
          "mt-8 grid gap-4",
          isList ? "grid-cols-1" : "sm:grid-cols-2",
        )}
      >
        {section.items.map((item) => (
          <Card key={item.title} className="ring-brand-100">
            <CardHeader>
              <CardTitle className="text-lg text-brand-800">
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base text-muted-foreground">
                {item.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
