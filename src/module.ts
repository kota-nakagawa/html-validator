import { fileURLToPath, pathToFileURL } from 'node:url'
import chalk from 'chalk'
import { normalize } from 'pathe'
import { isWindows } from 'std-env'

import { defineNuxtModule, isNuxt2, logger, resolvePath } from '@nuxt/kit'
import { DEFAULTS, ModuleOptions } from './config'

export type { ModuleOptions }

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@nuxtjs/html-validator',
    configKey: 'htmlValidator',
    compatibility: {
      nuxt: '^2.0.0 || ^3.0.0-rc.7'
    }
  },
  defaults: nuxt => ({
    ...DEFAULTS,
    logLevel: nuxt.options.dev ? 'verbose' : 'warning'
  }),
  async setup (moduleOptions, nuxt) {
    logger.info(`Using ${chalk.bold('html-validate')} to validate server-rendered HTML`)

    const { usePrettier, failOnError, options, logLevel } = moduleOptions as Required<ModuleOptions>
    if ((nuxt.options as any).htmlValidator?.options?.extends) {
      options.extends = (nuxt.options as any).htmlValidator.options.extends
    }

    if (nuxt.options.dev) {
      nuxt.hook('nitro:config', (config) => {
        // Transpile the nitro plugin we're injecting
        config.externals = config.externals || {}
        config.externals.inline = config.externals.inline || []
        config.externals.inline.push('@nuxtjs/html-validator')

        // Add a nitro plugin that will run the validator for us on each request
        config.plugins = config.plugins || []
        config.plugins.push(normalize(fileURLToPath(new URL('./runtime/nitro', import.meta.url))))
        config.virtual = config.virtual || {}
        config.virtual['#html-validator-config'] = `export default ${JSON.stringify(moduleOptions)}`
      })
    }

    if (!nuxt.options.dev || isNuxt2()) {
      const validatorPath = await resolvePath(fileURLToPath(new URL('./runtime/validator', import.meta.url)))
      const { useChecker, getValidator } = await import(isWindows ? pathToFileURL(validatorPath).href : validatorPath)
      const validator = getValidator(options)
      const { checkHTML, invalidPages } = useChecker(validator, usePrettier, logLevel)

      if (failOnError) {
        const errorIfNeeded = () => {
          if (invalidPages.length) {
            throw new Error('html-validator found errors')
          }
        }

        // @ts-expect-error TODO: use @nuxt/bridge-schema
        nuxt.hook('generate:done', errorIfNeeded)
        nuxt.hook('close', errorIfNeeded)
      }

      // Nuxt 3/Nuxt Bridge prerendering

      nuxt.hook('nitro:init', (nitro) => {
        nitro.hooks.hook('prerender:generate', (route) => {
          if (!route.contents || !route.fileName?.endsWith('.html')) { return }
          checkHTML(route.route, route.contents)
        })
      })

      // Nuxt 2

      if (isNuxt2()) {
        // @ts-expect-error TODO: use @nuxt/bridge-schema
        nuxt.hook('render:route', (url: string, result: { html: string }) => checkHTML(url, result.html))
        // @ts-expect-error TODO: use @nuxt/bridge-schema
        nuxt.hook('generate:page', ({ path, html }: { path: string, html: string }) => checkHTML(path, html))
      }
    }
  }
})
