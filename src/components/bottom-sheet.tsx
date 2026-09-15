"use client";

// KAN-59: the one sheet a day, a task or a letter opens in.

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * The prototype's `.sheet`: a card-coloured panel rising from the bottom with
 * a 14px top corner, a small dim line on top saying what it is about, what it
 * holds, and Close at the end.
 *
 * A day on the calendar, a task on Home and a letter in Your letters all open
 * in it, so opening anything looks and closes the same way wherever she is.
 * On a wide screen it keeps a readable width rather than running the width of
 * the monitor.
 */
export function BottomSheet({
  open,
  onClose,
  heading,
  children,
}: {
  open: boolean;
  onClose: () => void;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[76vh] gap-0 overflow-y-auto rounded-t-[14px] bg-card px-[18px] pt-[18px] pb-6 md:mx-auto md:max-w-2xl"
      >
        {/* `.dd-day`: 13px, semibold, dim. */}
        <SheetHeader className="p-0">
          <SheetTitle className="mb-2 text-key font-semibold text-ink-dim">
            {heading}
          </SheetTitle>
        </SheetHeader>
        <div>
          {children}
          <Button
            variant="quiet"
            size="block-quiet"
            className="mt-2"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
