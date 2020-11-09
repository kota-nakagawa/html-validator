import type { Module } from '@nuxt/types'
import chalk from 'chalk'
import consola from 'consola'
import defu from 'defu'

import { DEFAULTS, ModuleOptions } from './config'
import { useChecker, useValidator } from './validator'

const CONFIG_KEY = 'htmlValidator'

const nuxtModule: Module<ModuleOptions> = function (moduleOptions) {
  consola.info(
    `Using ${chalk.bold('html-validate')} to validate server-rendered HTML`
  )

  const { usePrettier, options } = defu(this.options[CONFIG_KEY] || {}, moduleOptions, DEFAULTS)
  const { validator } = useValidator(options)

  const checkHTML = useChecker(validator, usePrettier)

  this.nuxt.hook('render:route', (url: string, result: { html: string }) => checkHTML(url, result.html))
  this.nuxt.hook('generate:page', ({ path, html }: { path: string, html: string }) => checkHTML(path, html))
}

;(nuxtModule as any).meta = { name: '@nuxtjs/html-validator' }

declare module '@nuxt/types' {
  interface NuxtConfig { [CONFIG_KEY]?: ModuleOptions } // Nuxt 2.14+
  interface Configuration { [CONFIG_KEY]?: ModuleOptions } // Nuxt 2.9 - 2.13
}

export default nuxtModule

export type { ModuleOptions }
