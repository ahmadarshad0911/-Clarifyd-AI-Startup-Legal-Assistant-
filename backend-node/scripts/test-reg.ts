import { config } from 'dotenv';
config({ path: '.env.local', override: true });

const main = async () => {
  const { DEFAULT_SOURCES, diffRegulationSource } = await import('../src/lib/regulation');
  for (const s of DEFAULT_SOURCES) {
    try {
      const r = await diffRegulationSource(s);
      console.log(s.source, JSON.stringify(r));
    } catch (e) {
      console.log(s.source, 'ERR', String(e).slice(0, 200));
    }
  }
};
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
