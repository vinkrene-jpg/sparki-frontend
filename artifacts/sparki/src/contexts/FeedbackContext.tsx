// Global feedback entry point. Provides `openFeedback()` to any signed-in
// surface and renders the single shared FeedbackSheet once. Keeping the sheet
// here (not inside ScreenShell) means the header trigger and the Profiel page
// share one canonical reporter — no duplicate feedback UIs.

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { FeedbackSheet } from "@/components/sparki/feedback-sheet"

interface FeedbackContextValue {
  openFeedback: () => void
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openFeedback = useCallback(() => setOpen(true), [])
  return (
    <FeedbackContext.Provider value={{ openFeedback }}>
      {children}
      {open && <FeedbackSheet onClose={() => setOpen(false)} />}
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider")
  return ctx
}
