"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { ConfirmProvider } from "@/frontend/components/ui/confirm";
import { ToastProvider } from "@/frontend/components/ui/toast";
import { I18nProvider } from "@/shared/i18n/client";
import type { Locale } from "@/shared/i18n/config";
import type { Messages } from "@/shared/i18n/messages/fr";

export function Providers({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  return (
    <I18nProvider locale={locale} messages={messages}>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </MotionConfig>
    </I18nProvider>
  );
}
