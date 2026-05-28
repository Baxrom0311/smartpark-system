# Agent Rules

All AI coding agents working on this project MUST follow these rules strictly.

## General Rules

1. **No secrets in code.** Use `.env` files (gitignored) and `.env.example` for documentation.
2. **Pin all dependencies.** Use exact versions. No `^` or `~` ranges.
3. **Run verification after every change.** Tests, build, type-check.
4. **Production-quality code.** Proper error handling, input validation, type safety.
5. **No placeholder/TODO code.** Every file must be functional.
6. **Mock external services** for local development.

## Code Quality

- Proper error handling and input validation
- Type safety (TypeScript strict, Python type hints)
- Meaningful variable names
- Consistent formatting

## Naming Conventions

- Python: snake_case
- TypeScript/JS: camelCase for variables, PascalCase for components
- API routes: kebab-case in URLs, snake_case in JSON bodies
- Database: snake_case for tables and columns
- Files: kebab-case for routes, PascalCase for components

## Commit Messages

Format: `feat(scope): description` or `fix(scope): description`

Examples:
- `feat(api): add JWT authentication`
- `feat(web): implement dashboard page`
- `fix(api): handle edge case in validation`

## Review Focus

1. Correctness — matches PROJECT_BRIEF acceptance criteria
2. Type safety — no `any`, proper types
3. Security — auth, input validation, no SQL injection
4. Error handling — graceful failures
5. Testing — core logic has tests
