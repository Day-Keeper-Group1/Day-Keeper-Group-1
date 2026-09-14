// KAN-57: the accessibility panel on its own page, reached from the sidebar.

import { AccessibilitySettings } from "@/components/accessibility-settings";
import { ScreenHeader } from "@/components/screen";

/**
 * The panel, given a screen of its own.
 *
 * No subtitle here. The panel already opens with "Make DayKeeper easier to
 * use" and a line saying the choices apply across the app on this device, and
 * two introductions stacked on top of each other read as a mistake rather than
 * as emphasis. The panel itself is untouched by this ticket, so the sentence
 * that had to go was the one this page added.
 */
export default function AccessibilityPage() {
  return (
    <div>
      <ScreenHeader title="Accessibility" />
      <AccessibilitySettings />
    </div>
  );
}
