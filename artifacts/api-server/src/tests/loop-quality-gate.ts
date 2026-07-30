// Wrapper zodat scripts/run-test.mjs (dat src/tests/<naam>.ts bouwt) de
// deterministische harde-afkeurpoort-test kan draaien. De test zelf staat
// naast de code in src/lib/routing/loop-quality-gate.test.ts en voert bij
// import direct uit.
import "../lib/routing/loop-quality-gate.test";
