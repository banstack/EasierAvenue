import Link from "next/link";
import { ReactNode } from "react";

interface NavbarProps {
  children?: ReactNode; // optional right-side slot for page-specific controls
}

export default function Navbar({ children }: NavbarProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="text-xl font-bold shrink-0">
          Easier<span className="text-primary">Avenue</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/key"
            className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Price Index
          </Link>
        </nav>

        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
