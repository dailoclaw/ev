// Two distinct production fixtures; markers never enter the shipping build.
import { build } from 'vite'

for (const revision of ['a', 'b']) {
  await build({
    build: { outDir: `dist-validation/${revision}` },
    plugins: [{
      name: 'validation-build-marker',
      enforce: 'pre',
      transform(source, id) {
        if (id.endsWith('/src/main.tsx')) return `${source}\ndocument.documentElement.dataset.validationBuild = '${revision}'\n`
        if (id.endsWith('/src/pages/Settings.tsx')) return source.replace('EV Command v{APP_VERSION}', `Validation ${revision} · EV Command v{APP_VERSION}`)
        if (id.endsWith('/src/pages/Statement.tsx')) return `${source}\ndocument.documentElement.dataset.validationStatement = '${revision}'\n`
      },
    }],
  })
}
