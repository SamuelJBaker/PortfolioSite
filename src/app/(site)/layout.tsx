import { BackgroundEffectsProvider } from "../../components/background3d/BackgroundEffectsProvider";
import { SiteBackground } from "../../components/background3d/SiteBackground";

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
    </BackgroundEffectsProvider>
  );
}
