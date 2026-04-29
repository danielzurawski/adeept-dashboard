/**
 * Page Object for the **Capabilities & Roadmap** section
 * (`<section id="apps">`). The gallery aggregates capability cards and
 * the three openable sub-panels (`live-occupancy-map`, `camera-view`,
 * and the browser-only `occupancy-map`).
 */

import type { Page, Locator } from '@playwright/test'

export type AppPanelLabel =
  | 'Live Camera'
  | 'Live Occupancy Map'
  | 'Occupancy Mapping (sim)'

export class AppGallery {
  readonly page: Page
  readonly section: Locator

  constructor(page: Page) {
    this.page = page
    this.section = page.locator('section#apps')
  }

  get searchInput(): Locator {
    return this.section.getByPlaceholder('Search apps, features, or tags...')
  }

  /**
   * Locate the title span of a capability card. The cards do not use
   * a heading element for the name; instead they render a
   * `<span class="font-medium">` so the dense grid stays compact.
   * Matching by the visible text alone risks colliding with tags or
   * other text fragments, so we anchor to the span class.
   */
  capabilityTitle(name: string): Locator {
    return this.section.locator('span.font-medium', { hasText: name })
  }

  /**
   * The "Open panel" button that belongs to the capability whose
   * visible title equals `cardName`. The dashboard renders many
   * "Open panel" buttons (one per openable card) so we MUST scope to
   * the surrounding card, which is the closest ancestor `<div>` that
   * uses the rounded-border card classes.
   */
  openPanelButton(cardName: string): Locator {
    return this.capabilityTitle(cardName)
      .locator(
        'xpath=ancestor::div[contains(@class,"rounded-lg") and contains(@class,"border")][1]',
      )
      .getByRole('button', { name: 'Open panel' })
  }

  /**
   * Locate the rendered panel header by label. AppShell mounts the
   * active panel inside a Card with the panel name as `<CardTitle>`.
   */
  panelHeading(label: AppPanelLabel): Locator {
    return this.page.getByRole('heading', { name: label, exact: true })
  }

  /** The close (X) button on the active panel card. */
  get closePanelButton(): Locator {
    return this.page
      .locator('div.border-primary\\/30')
      .first()
      .getByRole('button')
      .filter({ has: this.page.locator('svg.lucide-x, svg.lucide-X, svg').nth(0) })
      .first()
  }

  /**
   * The Capabilities heading (the gallery's own h3). Use this to
   * anchor scoped queries within the capabilities section.
   */
  get capabilitiesHeading(): Locator {
    return this.section.getByRole('heading', {
      name: 'Capabilities',
      exact: true,
    })
  }

  /** The Roadmap section heading. */
  get roadmapHeading(): Locator {
    return this.section.getByRole('heading', { name: 'Roadmap', exact: true })
  }

  /**
   * Card title (h-tag span) inside the Roadmap section. The roadmap
   * cards use a `<CardTitle>` heading rather than a plain span, which
   * is structurally different from the Capabilities cards.
   */
  roadmapCardTitle(name: string): Locator {
    return this.section
      .getByRole('heading')
      .filter({ hasText: name })
  }

  /**
   * Returns all currently visible capability card titles (for
   * filter-related assertions).
   */
  get visibleCapabilityTitles(): Locator {
    return this.section.locator('span.font-medium')
  }

  /**
   * Returns all currently visible roadmap card headings.
   */
  get visibleRoadmapTitles(): Locator {
    return this.section
      .getByRole('heading')
      .filter({ hasText: /(Following|Detection|Sequencer|Solver|Patrol|Voice|SLAM|Display|Stabilization|Remote|Arm|Dashboard|Scanner)/ })
  }
}
