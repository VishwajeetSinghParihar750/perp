import { Search, ChevronDown, Wallet, LogOut, FlaskConical } from "lucide-react";
import { useTrading } from "../context/TradingContext";

const NAV_ITEMS = ["Spot", "Futures", "Lend", "Vault", "Stocks", "BP"];

interface TopNavProps {
  onOpenAuth: (mode: "signin" | "signup") => void;
}

export function TopNav({ onOpenAuth }: TopNavProps) {
  const { isAuthenticated, user, logout, connected } = useTrading();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#1c1f26] bg-[#0a0b0d] px-4">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-[11px] font-black text-black">
            B
          </div>
          <span className="text-[15px] font-bold tracking-tight text-white">
            Backpack
          </span>
        </div>
        <nav className="hidden items-center gap-5 text-[13px] font-medium text-[#9aa0aa] md:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              className={`transition-colors hover:text-white ${
                item === "Futures" ? "text-white" : ""
              }`}
            >
              {item}
            </button>
          ))}
          <button className="flex items-center gap-1 transition-colors hover:text-white">
            More <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <a
          href="/loadtest"
          className="flex items-center gap-1.5 rounded-lg border border-[#1c1f26] bg-[#111317] px-3 py-1.5 text-[13px] font-semibold text-[#9aa0aa] transition-colors hover:border-[#16c784] hover:text-[#16c784]"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Simulation</span>
        </a>
        <button className="rounded-md p-2 text-[#9aa0aa] transition-colors hover:bg-[#15181d] hover:text-white">
          <Search className="h-4 w-4" />
        </button>
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-[#1c1f26] bg-[#111317] px-3 py-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? "bg-[#16c784]" : "bg-[#f6465d]"
                }`}
              />
              <Wallet className="h-3.5 w-3.5 text-[#9aa0aa]" />
              <span className="font-mono text-xs font-semibold text-white">
                {user?.username}
              </span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1 rounded-lg border border-[#1c1f26] bg-[#111317] px-3 py-1.5 text-xs font-semibold text-[#9aa0aa] transition-colors hover:text-[#f6465d]"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onOpenAuth("signin")}
              className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[#9aa0aa] transition-colors hover:text-white"
            >
              Log in
            </button>
            <button
              onClick={() => onOpenAuth("signup")}
              className="rounded-lg bg-[#16c784] px-3.5 py-1.5 text-[13px] font-bold text-black transition-colors hover:bg-[#13b377]"
            >
              Sign up
            </button>
          </>
        )}
      </div>
    </header>
  );
}
