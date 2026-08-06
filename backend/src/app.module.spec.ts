import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

/**
 * Boots the real dependency-injection graph.
 *
 * Every other spec constructs its subject with `new`, which is fast and focused
 * but proves nothing about whether Nest can wire the application together. On
 * 2026-08-06 that gap took production down: `SsoAuthGuard` gained a dependency on
 * a service provided by a feature module, `AuthModule` did not import it, and
 * nothing failed until the container refused to start — 274 green tests and a
 * clean build either side of a total outage.
 *
 * This is the cheapest possible guard against that class of mistake: if a
 * provider cannot be resolved, or a module forgets an import, `compile()` throws
 * exactly as the container would.
 */
describe('AppModule', () => {
  const savedDatabaseUrl = process.env.DATABASE_URL;

  beforeAll(() => {
    // PrismaService refuses to construct without this. A pg Pool is lazy, so no
    // connection is attempted just by building the graph.
    process.env.DATABASE_URL ??=
      'postgresql://unused:unused@localhost:1/unused_by_this_test';
  });

  afterAll(() => {
    if (savedDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = savedDatabaseUrl;
    }
  });

  it('resolves every provider in the application', async () => {
    // compile() instantiates providers without running onModuleInit, so nothing
    // opens a socket or starts the timer scheduler.
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
