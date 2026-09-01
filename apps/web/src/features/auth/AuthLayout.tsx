import type { ReactNode } from "react";
import { Card } from "../../components/Card";
import { LogoMark } from "../../components/Logo";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="animate-pop-in w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoMark className="mx-auto mb-3 h-14 w-14" />
          <h1 className="font-display text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-sm text-white/60">{subtitle}</p>
        </div>
        <Card intensity="strong">{children}</Card>
      </div>
    </div>
  );
}
