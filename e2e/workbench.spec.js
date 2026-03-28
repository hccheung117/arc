import { test, expect } from '@playwright/test'
import { launchApp } from './helpers.js'

let electronApp, window

test.beforeAll(async () => {
  ;({ electronApp, window } = await launchApp())
})

test.afterAll(async () => {
  await electronApp?.close()
})

test.describe('header title', () => {
  test('long title is truncated and does not overflow header', async () => {
    // Set a very long title directly on the DOM and verify CSS truncation
    const result = await window.evaluate(() => {
      const span = document.querySelector('header span.truncate')
      const header = document.querySelector('header')
      span.textContent = 'A'.repeat(500)

      // Force reflow
      void span.offsetWidth

      return {
        isTruncated: span.scrollWidth > span.clientWidth,
        titleRight: span.getBoundingClientRect().right,
        headerRight: header.getBoundingClientRect().right,
      }
    })

    // Title text should be truncated (scrollWidth exceeds visible width)
    expect(result.isTruncated).toBe(true)

    // Title must not extend past the header boundary
    expect(result.titleRight).toBeLessThan(result.headerRight)
  })
})
