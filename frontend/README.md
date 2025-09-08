This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing

This project includes comprehensive test suites for the services layer with **104+ tests** covering unit, integration, and end-to-end scenarios.

### Quick Test Commands

```bash
# Run all tests
bun test

# Run tests in watch mode
bun run test:watch

# Run with coverage
bun run test:coverage

# Run with Vitest UI (web dashboard)
bun run test:ui
```

### Unit Tests (42 tests)
Test individual components and utilities in isolation:

```bash
# All unit tests
bun run test:unit

# Session management tests
bun run test:unit:session

# SSE parser tests  
bun run test:unit:parser

# Watch mode for unit tests
bun run test:unit:watch
```

### Integration Tests (62 tests)
Test API integrations with MSW mocking:

```bash
# All integration tests
bun run test:integration

# Research API v1 tests
bun run test:integration:api

# Research API v2 tests
bun run test:integration:api2

# End-to-end workflow tests
bun run test:integration:e2e

# Watch mode for integration tests
bun run test:integration:watch
```

### Services Tests
Test the entire services layer:

```bash
# All services tests
bun run test:services

# Services in watch mode
bun run test:services:watch
```

### Additional Commands
```bash
# Run tests once (no watch mode)
bun run test:run
```

### Test Architecture

- **Unit Tests** (`src/services/__tests__/unit/`): Fast, isolated tests for utilities and components
- **Integration Tests** (`src/services/__tests__/integration/`): Tests with API mocking via MSW
- **End-to-End Tests**: Full workflow tests simulating real user scenarios
- **Test Coverage**: Comprehensive coverage of error handling, edge cases, and happy paths

### Technologies Used

- **Vitest** - Fast test runner with TypeScript support
- **MSW v2.4.3** - API mocking for integration tests (Bun compatible)
- **Testing Library** - React component testing utilities
- **TypeScript** - Full type safety in tests
- **JSdom** - Browser environment simulation

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
