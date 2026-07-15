export function Home() {
  // The app shell (pathless `_app` layout) provides the surrounding <main>, so this
  // renders only the page's own content.
  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            fair <em>n</em> square
          </h1>
          <p className="page-sub">webapp walking skeleton — React + TanStack Start (BFF).</p>
        </div>
      </div>
    </section>
  )
}
