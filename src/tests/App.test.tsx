import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect } from "vitest"
import { App } from "../App"
import { createFakeResearch } from "../lib/createFakeResearch"

const research = createFakeResearch({ delayMs: 0 })

describe("App", () => {
  it("shows the current location, a map, and nearby story previews", async () => {
    render(<App research={research} />)
    expect(await screen.findByText(/candlemaker row/)).toBeInTheDocument()
    expect(
      await screen.findByText("The worst poet in the world is buried here"),
    ).toBeInTheDocument()
    expect(screen.getByText(/greyfriars kirkyard/)).toBeInTheDocument()
    expect(screen.getByText("90m")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Map of stories within 200 m" })).toBeInTheDocument()
  })

  it("opens a story with its full account and sources", async () => {
    const user = userEvent.setup()
    render(<App research={research} />)
    await user.click(await screen.findByRole("button", { name: /worst poet/ }))
    expect(await screen.findByText(/Dundee handloom weaver/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /mcgonagall online/ })).toHaveAttribute(
      "href",
      "https://www.mcgonagall-online.org.uk/",
    )
  })

  it("answers a follow-up question about the open story", async () => {
    const user = userEvent.setup()
    render(<App research={research} />)
    await user.click(await screen.findByRole("button", { name: /worst poet/ }))
    await user.type(
      await screen.findByPlaceholderText("ask a follow-up"),
      "Did he know people were laughing at him?{enter}",
    )
    expect(await screen.findByText("Did he know people were laughing at him?")).toBeInTheDocument()
    expect(await screen.findByText(/Probably he knew/)).toBeInTheDocument()
    expect(screen.getByText(/poetic gems/)).toBeInTheDocument()
  })

  it("starts a general chat about the location from the nearby screen", async () => {
    const user = userEvent.setup()
    render(<App research={research} />)
    await user.type(
      await screen.findByPlaceholderText("ask about this place"),
      "Why is it called Candlemaker Row?{enter}",
    )
    expect(await screen.findByText(/candlemakers’ guild/)).toBeInTheDocument()
  })

  it("returns from a story to the nearby list", async () => {
    const user = userEvent.setup()
    render(<App research={research} />)
    await user.click(await screen.findByRole("button", { name: /worst poet/ }))
    await user.click(await screen.findByRole("button", { name: /back/ }))
    expect(await screen.findByRole("button", { name: /Bobby/ })).toBeInTheDocument()
  })
})
