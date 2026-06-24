// ── Smart Missing Input navigation ───────────────────────────────────────────
// The return/retry mechanism. When a user taps a "missing input" action button,
// we navigate to the input's page carrying three things in the URL:
//   ?focus=<token>   → tells the destination page which editor to open + highlight
//   &returnTo=<path> → where to send the user back after they fill it in
//   &retry=<action>  → which action to re-attempt on the origin page
// After the value is saved, the destination calls completeFix() which navigates
// back to returnTo with ?retry=<action>; the origin page re-runs the action.

import { useCallback, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { INPUT_TARGETS, type InputTargetKey } from "@/lib/missing-input";

export interface FixOptions {
  /** Path to return to once the value is saved (e.g. "/train"). */
  returnTo?: string;
  /** Action key the origin page should re-attempt on return (e.g. "generate-plan"). */
  retry?: string;
}

/** Start fixing a missing input: navigate to its editor carrying return/retry. */
export function useStartFix() {
  const [, navigate] = useLocation();
  return useCallback(
    (key: InputTargetKey, opts: FixOptions = {}) => {
      const target = INPUT_TARGETS[key];
      const params = new URLSearchParams();
      params.set("focus", target.focus);
      if (opts.returnTo) params.set("returnTo", opts.returnTo);
      if (opts.retry) params.set("retry", opts.retry);
      navigate(`${target.route}?${params.toString()}`);
    },
    [navigate],
  );
}

/** Read the focus/return/retry params on the current route. */
export function useFixParams() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  return {
    focus: params.get("focus"),
    returnTo: params.get("returnTo"),
    retry: params.get("retry"),
  };
}

/**
 * On a destination page: returns a callback that sends the user back to the
 * origin (with ?retry=…) after they save. Returns false when there is no
 * pending return journey (so the page can just close its editor in place).
 */
export function useCompleteFix() {
  const [, navigate] = useLocation();
  const { returnTo, retry } = useFixParams();
  return useCallback((): boolean => {
    if (!returnTo) return false;
    const qs = retry ? `?retry=${encodeURIComponent(retry)}` : "";
    navigate(`${returnTo}${qs}`);
    return true;
  }, [navigate, returnTo, retry]);
}

/**
 * On an origin page: runs `run` exactly once when the URL carries
 * `?retry=<expectedKey>` (i.e. the user just came back from filling in a missing
 * value), then strips the retry param so it never fires twice.
 */
export function useRetryAction(expectedKey: string, run: () => void): void {
  const [location, navigate] = useLocation();
  const { retry } = useFixParams();
  const firedRef = useRef(false);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (retry === expectedKey && !firedRef.current) {
      firedRef.current = true;
      navigate(location, { replace: true });
      runRef.current();
    }
  }, [retry, expectedKey, location, navigate]);
}
