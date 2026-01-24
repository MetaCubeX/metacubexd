# Testing Patterns

**Analysis Date:** 2026-01-25

## Test Framework

**Runner:**

- Vitest (`vitest`) - Version `4.0.15` as per `package.json`.
- E2E tests leverage Playwright (`@playwright/test`).

**Assertion Library:**

- `expect` is used, presumably from Vitest (e.g., `e2e/pages.spec.ts`).

**Run Commands:**

```bash
pnpm test:e2e              # Run all e2e tests
```

## Test File Organization

**Location:**

- E2E tests are located in the `e2e/` directory.

**Naming:**

- E2E test files follow the `.spec.ts` naming convention (e.g., `e2e/pages.spec.ts`).

**Structure:**

```
[project-root]/
├── e2e/
│   └── [feature].spec.ts # E2E tests for specific features/pages
```

## Test Structure

**Suite Organization:**
Test suites use `describe` blocks to group related tests, with individual tests defined by `it`. Setup and teardown are handled by `beforeAll` and `afterAll`.

```typescript
// e2e/pages.spec.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('...', () => {
  let browser: Browser
  let context: BrowserContext
  let page: Page
  let server: ChildProcess | undefined

  beforeAll(async () => {
    // Setup server and browser
  })

  afterAll(async () => {
    // Teardown server and browser
  })

  it('...', async () => {
    // Test steps
  })
})
```

**Patterns:**

- **Setup pattern:** `beforeAll` is used to set up the testing environment, including starting a server and launching a browser instance (e.g., `e2e/pages.spec.ts`).
- **Teardown pattern:** `afterAll` is used to clean up resources after all tests are run (e.g., stopping the server, closing the browser).
- **Assertion pattern:** `expect` is used with matchers (e.g., `expect(response.status()).toBe(200)`).

## Mocking

**Framework:** Custom mock implementation.

**Patterns:**

- The `composables/useApi.ts` file includes a `useMockMode()` function and `getMockData()` to return predefined data when `MOCK_MODE=true` environment variable is set. This allows the application to run without a live backend.

```typescript
// composables/useApi.ts
export function useMockMode() {
  const config = useRuntimeConfig()
  return config.public.mockMode === true
}

// ... in useRequest()
if (useMockMode()) {
  // In mock mode, return a mock handler
  const mockHandler = async <T>(url: string): Promise<T> => {
    return getMockData(url) as T
  }
  // ...
}
```

**What to Mock:**

- API responses are mocked when `MOCK_MODE` is enabled, simulating backend behavior without actual network requests.

**What NOT to Mock:**

- Not explicitly defined, but generally, core UI logic and non-API related functionalities are not mocked.

## Fixtures and Factories

**Test Data:**

- `useMockData()` in `composables/useMockData.ts` is likely used to provide mock data for various API endpoints.

**Location:**

- Mock data functions are likely defined in `composables/useMockData.ts`.

## Coverage

**Requirements:** None explicitly enforced in `package.json` scripts or configuration files found.

**View Coverage:** No explicit command found for viewing test coverage.

## Test Types

**Unit Tests:**

- Not explicitly detected for application-specific logic within the `src` directory from the `find` command output, which mainly showed `node_modules` test files. The project primarily uses Vue components and composables, which might be tested as part of integration or e2e flows.

**Integration Tests:**

- Implicitly covered by E2E tests that involve multiple components and API interactions, especially with the mock API implementation.

**E2E Tests:**

- **Framework:** Playwright integrated with Vitest (as seen in `e2e/pages.spec.ts` and `package.json`).
- **Scope and approach:** E2E tests (`e2e/pages.spec.ts`) focus on launching a Nuxt.js server, controlling a Chromium browser, and interacting with application pages to verify end-to-end functionality. They check server readiness, page navigation, and content.

## Common Patterns

**Async Testing:**

- `async/await` syntax is used in `beforeAll`, `afterAll`, and `it` blocks for handling asynchronous operations like server startup and browser interactions (e.g., `e2e/pages.spec.ts`).

**Error Testing:**

- `throw new Error()` is used to indicate critical failures within test setup (e.g., `e2e/pages.spec.ts`).

---

_Testing analysis: 2026-01-25_
