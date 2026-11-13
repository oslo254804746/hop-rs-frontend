import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useI18n } from '@/i18n'
import { router } from '@/router'

function listFilesRecursive(dir: string, predicate: (filePath: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(fullPath, predicate))
    } else if (predicate(fullPath)) {
      out.push(fullPath)
    }
  }
  return out
}

describe('router document.title locale sync & strict CSP invariants', () => {
  it('updates document.title immediately when toggling locale without route navigation', async () => {
    const { setLocale } = useI18n()
    setLocale('en')
    await router.push('/assets')
    await router.isReady()

    expect(document.title).toBe('Assets · Hop')

    setLocale('zh-CN')
    await nextTick()
    expect(document.title).toBe('资产 · Hop')

    setLocale('en')
    await nextTick()
    expect(document.title).toBe('Assets · Hop')
  })

  it('keeps panel source free of zod runtime imports, eval, Function constructors, and unnamed form controls', () => {
    const srcRoot = path.resolve(process.cwd(), 'src')
    const sourceFiles = listFilesRecursive(
      srcRoot,
      (file) =>
        (file.endsWith('.ts') || file.endsWith('.vue')) && !file.endsWith('.spec.ts'),
    )

    expect(sourceFiles.length).toBeGreaterThan(10)

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8')
      expect(content, `${file} must not import zod (new Function CSP probe)`).not.toMatch(
        /from\s+['"]zod['"]/,
      )
      expect(content, `${file} must not invoke new Function`).not.toMatch(/\bnew\s+Function\s*\(/)
      expect(content, `${file} must not invoke eval(`).not.toMatch(/\beval\s*\(/)

      if (file.endsWith('.vue')) {
        const controls = content.match(/<(input|select|textarea)\b[^>]*>/gs) ?? []
        for (const control of controls) {
          expect(
            /(?:^|\s|:)name\s*=/.test(control),
            `${file} has form control missing name attribute: ${control}`,
          ).toBe(true)
        }
      }
    }
  })

  it('verifies built production and OpenWrt JS bundles contain zero Function( or eval( calls when present', () => {
    for (const distDir of ['dist', 'dist-openwrt']) {
      const fullDist = path.resolve(process.cwd(), distDir)
      const jsFiles = listFilesRecursive(fullDist, (file) => file.endsWith('.js'))
      for (const jsFile of jsFiles) {
        const bundle = fs.readFileSync(jsFile, 'utf8')
        expect(bundle, `${jsFile} must not contain new Function(`).not.toMatch(
          /\bnew\s+Function\s*\(/,
        )
        expect(bundle, `${jsFile} must not contain Function("")`).not.toMatch(
          /\bFunction\s*\(\s*['"`]/,
        )
        expect(bundle, `${jsFile} must not contain direct eval(`).not.toMatch(/\beval\s*\(/)
      }
    }
  })
})
