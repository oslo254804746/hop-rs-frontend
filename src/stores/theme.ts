import { computed, ref } from 'vue'

export type ThemePreference = 'system' | 'dark' | 'light'

const themeKey = 'hop.theme'
const savedTheme = window.sessionStorage.getItem(themeKey)
const preference = ref<ThemePreference>(
  savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'system',
)

const resolvedTheme = computed<'dark' | 'light'>(() => {
  if (preference.value !== 'system') return preference.value
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
})

function applyTheme() {
  document.documentElement.dataset.theme = resolvedTheme.value
  document.documentElement.style.colorScheme = resolvedTheme.value
}
function setTheme(value: ThemePreference) {
  preference.value = value
  if (value === 'system') window.sessionStorage.removeItem(themeKey)
  else window.sessionStorage.setItem(themeKey, value)
  applyTheme()
}

function toggleTheme() {
  setTheme(resolvedTheme.value === 'dark' ? 'light' : 'dark')
}

window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (preference.value === 'system') applyTheme()
})
applyTheme()

export function useTheme() {
  return { preference, resolvedTheme, setTheme, toggleTheme }
}
