/** Render the starter page. */
export function App(
  /** The starter page accepts no properties. */
  _props: Props,
) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold">Hello, world</h1>
    </main>
  )
}

type Props = Record<string, never>
