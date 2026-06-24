import { createContext, useContext, useState, type ReactNode } from "react"

// Vandaag has two surfaces that share one route: the calm State Card (default)
// and the full day-type analysis (the existing CTL/ATL/TSB/HRV/readiness cards).
// This context lets the State Card open the full analysis as a drill-in and lets
// the ScreenShell render a top "Terug" to come back — without adding a new screen
// or route. It is mounted ONLY around Vandaag; every other section sees no
// provider (useHomeView → null) and behaves exactly as before.
export type HomeView = "state" | "full"

type HomeViewCtx = {
  view: HomeView
  setView: (view: HomeView) => void
}

const HomeViewContext = createContext<HomeViewCtx | null>(null)

export function HomeViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<HomeView>("state")
  return (
    <HomeViewContext.Provider value={{ view, setView }}>
      {children}
    </HomeViewContext.Provider>
  )
}

/** Returns the Vandaag view controller, or null outside the Vandaag surface. */
export function useHomeView(): HomeViewCtx | null {
  return useContext(HomeViewContext)
}
