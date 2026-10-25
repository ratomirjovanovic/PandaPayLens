# Repository guide

Conventions for anyone (people or tools) changing code in this repository. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## Setup and commands

```bash
pnpm install
pnpm build:packages   # build workspace packages (required before apps and the CLI)
pnpm test             # vitest: core, adapters, rules, providers, CLI, admin services
pnpm typecheck
pnpm dev:pages        # static analyzer at http://localhost:3200/PandaPayLens/
pnpm build:pages      # static export + verification (apps/pages/out)
pnpm --filter @pandapaylens/pages run test:e2e
pnpm build && pnpm test:e2e   # full app (apps/web) and its Playwright tests
```

## Ground rules

- **Local-first.** Imported payment data never leaves the browser. No network, storage, eval or dynamic code in `packages/core`, adapters or rules.
- **No invented data.** Codes, statuses and formats come from official provider documentation (see `docs/providers/research/`). Unknown stays unknown.
- **Honest capabilities.** A manifest capability is `supported` only when implemented and tested.
- **Synthetic fixtures only.** Identifiers contain `PPLsynth` or `PPLSYNTH`. Never commit real card, customer or merchant data.
- **No identifiers in finding text.** Reference evidence by event id so masking works.
- **Typography.** Use the plain hyphen "-" only; never the em dash or en dash characters.
- **Admin code stays server-side** (`apps/web/lib/admin`), and authorization is checked in service functions.

## Layout

| Path                     | Contents                                           |
| ------------------------ | -------------------------------------------------- |
| `packages/core`          | parsing, detection, engine, redaction, reports     |
| `packages/adapters/<id>` | one provider adapter each                          |
| `packages/providers`     | registry, manifests, roadmap                       |
| `packages/rules`         | diagnostic rules                                   |
| `packages/cli`           | command-line interface                             |
| `apps/web`               | Next.js app for Vercel                             |
| `apps/pages`             | static GitHub Pages build reusing `apps/web` pages |
| `fixtures`               | synthetic fixtures and `samples.json`              |

Adding a provider: follow [docs/contributing/add-provider.md](docs/contributing/add-provider.md) and [docs/contributing/adapter-brief.md](docs/contributing/adapter-brief.md).
