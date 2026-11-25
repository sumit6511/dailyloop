# End-to-end smoke tests

A real player journey through the production web build, the real API and a real database:
sign up, play Guess It (reading today's answer through the admin API), check the dashboard and
the global leaderboard, then log out and back in. Nothing is mocked; screens and accessibility
are covered separately by `visual/`.

```bash
npm run db:test:migrate                                   # schema on the test database
DATABASE_URL=postgresql://dailyloop_test:dailyloop_test_password@localhost:5433/dailyloop_test npm run db:seed
npm run test:e2e -w @dailyloop/web
```

Playwright starts the API on :4100 and a production build on :4174 itself. It uses the test
database from `docker-compose.yml` unless `E2E_DATABASE_URL` points elsewhere. The dev seed must
be applied (games, puzzles and the `admin` account). Each run signs up a fresh player, so it can
run repeatedly against the same database. The API test suite empties that database when it
starts, so seed it again before running these after `npm test`.
