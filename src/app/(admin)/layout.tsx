import { BackgroundEffectsProvider } from "../../components/background3d/BackgroundEffectsProvider";

/** Admin: same effect bus for parity, but no BackgroundCanvas, so three.js never ships here. */
export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <BackgroundEffectsProvider>
      <div className="relative z-20" data-ui>
        {children}
      </div>
    </BackgroundEffectsProvider>
  );
}
