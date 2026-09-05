# Project Rules & Development Guidelines

## Test-Driven Development (TDD) Mandate
- **Always follow Test-Driven Development (TDD)** for any new features, bug fixes, or modifications to logic/services/components in this project.
- **Workflow**:
  1. Write failing automated unit or integration tests specifying the expected behavior before writing the implementation.
  2. Run the test suite to verify failure (Red).
  3. Implement the minimal code necessary to make the tests pass (Green).
  4. Refactor code while ensuring all tests continue to pass (Refactor).
- Maintain robust test coverage across services, utilities, parsers, hooks, and critical UI interactions using Vitest and React Testing Library.
