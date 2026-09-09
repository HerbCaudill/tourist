import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { createFakeResearch } from "./lib/createFakeResearch"
import { createLiveResearch } from "./lib/createLiveResearch"
import { App } from "./App"

// Explicit adapter selection is available only in the development server.
const adapter = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get("research")
  : null
const research =
  adapter === "fixture"
    ? createFakeResearch({ delayMs: 0 })
    : adapter === "live"
      ? createLiveResearch()
      : undefined

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App research={research} />
  </StrictMode>,
)
