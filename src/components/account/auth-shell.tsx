import Image from "next/image";
import type { ReactNode } from "react";

/** Split layout: an artwork on the wall on one side, the form on the other. */
export function AuthShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <Image src="/brand/products/twin-mirrors-staged.jpg" alt="" fill preload sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-ink/20 to-ink" />
      </div>
      <div className="flex items-center justify-center px-4 pt-28 pb-16 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 flex flex-col gap-3">
            <h1 className="font-display text-title font-light">{title}</h1>
            <p className="text-sand">{intro}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
