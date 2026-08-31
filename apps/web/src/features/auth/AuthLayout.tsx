import type { ReactNode } from "react";
import { Card } from "../../components/Card";
import logoIcon from "../../assets/logo-icon.png";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-2xl bg-white/80 p-2.5 shadow-lg">
            <img src={logoIcon} alt="DailyLoop" className="h-12 w-12" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-sm text-white/60">{subtitle}</p>
        </div>
        <Card intensity="strong">{children}</Card>
      </div>
    </div>
  );
}
