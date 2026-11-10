import { BackgroundEffectsProvider } from "../../components/background3d/BackgroundEffectsProvider";
import { SiteBackground } from "../../components/background3d/SiteBackground";
import { ConsoleTrigger } from "../../components/devconsole/ConsoleTrigger";
import { DevtoolsGreeting } from "../../components/devconsole/DevtoolsGreeting";

/** Public site: the 3D background behind the page content. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <BackgroundEffectsProvider>
      {/* Canvas sits above the prepaint gradient. */}
      <SiteBackground />
      {/* Foreground content */}
      <div className="relative z-20" data-ui>
        {children}
      </div>
      {/* Engine console: key listener only; the panel is a lazy chunk loaded on first open. */}
      <ConsoleTrigger />
      <DevtoolsGreeting />
    </BackgroundEffectsProvider>
  );
}
