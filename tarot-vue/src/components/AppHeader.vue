<script setup lang="ts">
import type { Component } from 'vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Menu from '@icons/menu.vue'
import Music from '@icons/music.vue'
import Moon from '@icons/moon.vue'
import ChevronDown from '@icons/chevron-down.vue'
import UserRound from '@icons/user-round.vue'
import Clock from '@icons/clock.vue'
import BookOpen from '@icons/book-open.vue'
import Layers from '@icons/layers.vue'
import MessageSquare from '@icons/message-square.vue'
import LogOut from '@icons/log-out.vue'
import { useAuth } from '../composables/useAuth'
import { publicAssetUrl } from '../utils/publicAssetUrl'
import { applyLocaleToDocument, setStoredLocale, type AppLocale } from '@/utils/localeStorage'
import { applyRouteDocumentMeta } from '@/seo/documentMeta'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { user, isLoggedIn, logout } = useAuth()

const isImageAvatar = computed(() => {
  if (!user.value?.avatar) return false
  return user.value.avatar.startsWith('/') || user.value.avatar.startsWith('http')
})

const avatarImageSrc = computed(() => publicAssetUrl(user.value?.avatar))

const mobileMenuOpen = ref(false)
const scrolled = ref(false)
const dropdownOpen = ref(false)

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function closeDropdown(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.user-dropdown-container')) {
    dropdownOpen.value = false
  }
}

async function handleLogout() {
  dropdownOpen.value = false
  closeMobileMenu()
  await logout()
  router.push('/')
}

function onScroll() {
  scrolled.value = window.scrollY > 100
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('click', closeDropdown)
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('click', closeDropdown)
})

interface NavItem {
  to: string
  label: string
  name: string
}

const navItems = computed<NavItem[]>(() => [
  { to: '/tarot', label: t('nav.tarot'), name: 'tarot' },
  { to: '/fate-dual', label: t('nav.fateDual'), name: 'fate-dual' },
  { to: '/daily-fortune', label: t('nav.daily'), name: 'daily-fortune' },
  { to: '/yes-no-tarot', label: t('nav.yesNo'), name: 'yes-no-tarot' },
  { to: '/horoscope', label: t('nav.horoscope'), name: 'horoscope' },
  { to: '/cemetery', label: t('nav.cemetery'), name: 'cemetery' },
  { to: '/membership', label: t('nav.membership'), name: 'membership' },
])

interface DropdownItem {
  to?: string
  label: string
  icon: Component
}

const dropdownItems = computed<DropdownItem[]>(() => [
  { to: '/profile', label: t('userMenu.profile'), icon: UserRound },
  { to: '/history', label: t('userMenu.history'), icon: Clock },
  { to: '/oracle-gallery', label: t('nav.oracleGallery'), icon: BookOpen },
  { to: '/card-back-settings', label: t('userMenu.cardBack'), icon: Layers },
  { to: '/feedback', label: t('userMenu.feedback'), icon: MessageSquare },
])

function isActive(name: string): boolean {
  return route.name === name
}

function activeClass(name: string): string {
  return isActive(name)
    ? 'text-gold-400 nav-active'
    : 'text-gray-400 hover:text-gold-300'
}

function handleDropdownClick(item: DropdownItem) {
  dropdownOpen.value = false
  if (item.to) {
    router.push(item.to)
  }
}

const langButtonShort = computed(() =>
  locale.value === 'zh-CN' ? t('header.localeTargetEn') : t('header.localeTargetZh'),
)

function toggleLocale() {
  const next: AppLocale = locale.value === 'en-US' ? 'zh-CN' : 'en-US'
  locale.value = next
  setStoredLocale(next)
  applyLocaleToDocument(next)
  applyRouteDocumentMeta(route)
}
</script>

<template>
  <nav
    class="fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top,0px)] transition-all duration-300"
    :class="scrolled
      ? 'bg-abyss/95 backdrop-blur-xl border-b border-gold-500/10 shadow-lg shadow-gold-500/5'
      : 'bg-abyss/70 backdrop-blur-md border-b border-white/5'"
  >
    <div class="app-header-bar w-full max-w-[100vw]">
      <div class="flex min-h-14 items-center justify-between h-14 relative">
        <!-- Logo -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gold-300 transition-colors"
            :aria-label="t('header.openNavMenu')"
            :aria-expanded="mobileMenuOpen"
            aria-controls="etomd-mobile-nav"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <Menu :size="24" aria-hidden="true" />
          </button>
          <RouterLink to="/" class="flex items-center gap-2 no-underline group">
            <img src="../assets/logo/logo.png" alt="E-Tomd" class="w-7 h-7" />
            <span class="text-lg font-bold text-gold-300 tracking-wider font-serif transition-colors group-hover:text-gold-200">E-Tomd</span>
          </RouterLink>
        </div>

        <!-- Desktop Nav -->
        <div class="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-6">
          <RouterLink
            v-for="navItem in navItems"
            :key="navItem.name"
            :to="navItem.to"
            class="nav-link text-sm font-medium transition-all duration-200 relative"
            :class="activeClass(navItem.name)"
          >
            {{ navItem.label }}
          </RouterLink>
        </div>

        <!-- Right Controls -->
        <div class="flex items-center space-x-3">
          <button type="button" class="p-2 rounded-full text-gray-500 hover:text-gold-300 transition-colors" :title="t('header.bgmTitle')" :aria-label="t('header.bgm')">
            <Music :size="18" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="h-8 min-w-[2.25rem] rounded-full px-2 text-xs font-medium text-gray-400 hover:text-gold-300 transition-colors border border-transparent hover:border-gold-500/15"
            :title="t('header.langTitle')"
            :aria-label="t('header.lang')"
            @click="toggleLocale"
          >
            {{ langButtonShort }}
          </button>
          <button type="button" class="p-2 rounded-full text-gray-500 hover:text-gold-300 transition-colors" :title="t('header.themeTitle')" :aria-label="t('header.theme')">
            <Moon :size="18" aria-hidden="true" />
          </button>

          <!-- Logged in: user dropdown -->
          <div v-if="isLoggedIn && user" class="relative user-dropdown-container hidden sm:block">
            <button
              type="button"
              class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-gold-500/15 hover:border-gold-500/30 text-gray-300 hover:text-white text-sm transition-all"
              aria-haspopup="menu"
              :aria-expanded="dropdownOpen"
              :aria-label="t('userMenu.menuAria')"
              @click.stop="toggleDropdown"
            >
              <img v-if="isImageAvatar" :src="avatarImageSrc" alt="" class="w-6 h-6 rounded-full object-cover" />
              <span v-else class="text-lg">{{ user.avatar }}</span>
              <span class="max-w-[80px] truncate">{{ user.nickname }}</span>
              <ChevronDown class="w-3 h-3 transition-transform" :class="dropdownOpen ? 'rotate-180' : ''" :size="12" />
            </button>
            <Transition name="dropdown">
              <div v-if="dropdownOpen" role="menu" class="absolute right-0 mt-2 w-48 rounded-xl card-glass shadow-xl overflow-hidden py-1 border border-gold-500/10">
                <button
                  v-for="ddItem in dropdownItems"
                  :key="ddItem.to ?? ddItem.label"
                  type="button"
                  role="menuitem"
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gold-500/5 hover:text-gold-200 transition-colors text-left"
                  @click="handleDropdownClick(ddItem)"
                >
                  <component :is="ddItem.icon" class="w-4 h-4 flex-shrink-0" :size="16" :stroke-width="1.8" />
                  <span>{{ ddItem.label }}</span>
                </button>
                <div class="border-t border-gold-500/10 my-1"></div>
                <button
                  type="button"
                  role="menuitem"
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors text-left"
                  @click="handleLogout"
                >
                  <LogOut class="w-4 h-4" :size="16" :stroke-width="1.8" aria-hidden="true" />
                  <span>{{ t('userMenu.logout') }}</span>
                </button>
              </div>
            </Transition>
          </div>

          <!-- Not logged in: login button -->
          <RouterLink
            v-else
            to="/login"
            class="hidden sm:flex items-center px-5 py-1.5 rounded-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-abyss text-sm font-semibold transition-all hover:shadow-lg hover:shadow-gold-500/20"
          >
            {{ t('nav.login') }}
          </RouterLink>
        </div>
      </div>
    </div>
  </nav>

  <!-- Mobile Menu -->
  <div
    id="etomd-mobile-nav"
    v-show="mobileMenuOpen"
    role="navigation"
    :aria-label="t('header.mainNavAria')"
    class="app-header-drawer fixed inset-0 z-40 bg-abyss/98 backdrop-blur-xl flex flex-col px-6 pb-[env(safe-area-inset-bottom,0px)] shadow-[inset_0_0_100px_rgba(124,58,237,0.05)]"
  >
    <RouterLink to="/" class="block py-3 text-lg text-gray-200 border-b border-gold-500/10 font-serif" @click="closeMobileMenu">{{ t('nav.home') }}</RouterLink>
    <RouterLink
      v-for="navItem in navItems"
      :key="navItem.name"
      :to="navItem.to"
      class="block py-3 text-lg text-gray-200 border-b border-gold-500/10"
      @click="closeMobileMenu"
    >
      {{ navItem.label }}
    </RouterLink>

    <!-- Mobile: logged in -->
    <template v-if="isLoggedIn && user">
      <div class="mt-6 flex items-center gap-3 px-2">
        <img v-if="isImageAvatar" :src="avatarImageSrc" alt="" class="w-10 h-10 rounded-full object-cover" />
        <span v-else class="text-3xl">{{ user.avatar }}</span>
        <div>
          <p class="text-white font-medium">{{ user.nickname }}</p>
          <p class="text-gray-500 text-xs">{{ user.email }}</p>
        </div>
      </div>
      <div class="mt-4 space-y-1">
        <RouterLink
          v-for="ddItem in dropdownItems"
          :key="ddItem.to"
          :to="ddItem.to!"
          class="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-200 hover:bg-gold-500/5 transition-colors"
          @click="closeMobileMenu"
        >
          <component :is="ddItem.icon" class="w-5 h-5 flex-shrink-0 text-gray-500" :size="20" :stroke-width="1.8" />
          <span>{{ ddItem.label }}</span>
        </RouterLink>
      </div>
      <button
        class="mt-3 flex justify-center items-center gap-2 px-6 py-3 rounded-full border border-red-500/30 text-red-400 font-medium w-full"
        @click="handleLogout"
      >
        <LogOut class="w-5 h-5" :size="20" :stroke-width="1.8" />
        <span>{{ t('userMenu.logout') }}</span>
      </button>
    </template>

    <!-- Mobile: not logged in -->
    <RouterLink
      v-else
      to="/login"
      class="mt-6 flex justify-center items-center px-6 py-3 rounded-full bg-gradient-to-r from-gold-500 to-gold-600 text-abyss font-semibold"
      @click="closeMobileMenu"
    >
      {{ t('nav.login') }}
    </RouterLink>
  </div>
</template>

<style scoped>
.app-header-bar {
  padding-left: max(1rem, env(safe-area-inset-left, 0px));
  padding-right: max(1rem, env(safe-area-inset-right, 0px));
}
@media (min-width: 640px) {
  .app-header-bar {
    padding-left: max(2rem, env(safe-area-inset-left, 0px));
    padding-right: max(2rem, env(safe-area-inset-right, 0px));
  }
}
.app-header-drawer {
  padding-top: calc(5rem + env(safe-area-inset-top, 0px));
  padding-left: max(1.5rem, env(safe-area-inset-left, 0px));
  padding-right: max(1.5rem, env(safe-area-inset-right, 0px));
}
.nav-active {
  position: relative;
}
.nav-active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-gold-400), transparent);
  border-radius: 1px;
}
</style>
