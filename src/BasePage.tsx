import { useState } from 'react'
import './App.css'
import RunExperiment from './RunExperiment'
import VisualComponent from './VisualComponent'

type Page = 'visual-component' | 'run-experiment'

const tabs: { id: Page; label: string }[] = [
  { id: 'visual-component', label: 'Visual Component' },
  { id: 'run-experiment', label: 'Run Experiment' },
]

function BasePage() {
  const [activePage, setActivePage] = useState<Page>('visual-component')

  return (
    <main className="base_page">
      <nav className="page_tabs" aria-label="Application pages" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`${tab.id}-tab`}
            type="button"
            role="tab"
            className={`page_tab${activePage === tab.id ? ' page_tab--active' : ''}`}
            aria-controls={`${tab.id}-panel`}
            aria-selected={activePage === tab.id}
            onClick={() => setActivePage(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section
        id="visual-component-panel"
        className="page_content"
        role="tabpanel"
        aria-labelledby="visual-component-tab"
        hidden={activePage !== 'visual-component'}
      >
        <VisualComponent />
      </section>
      <section
        id="run-experiment-panel"
        className="page_content"
        role="tabpanel"
        aria-labelledby="run-experiment-tab"
        hidden={activePage !== 'run-experiment'}
      >
        <RunExperiment />
      </section>
    </main>
  )
}

export default BasePage
