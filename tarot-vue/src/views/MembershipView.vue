<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import { useUserResourcesStore } from '../stores/userResources'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
import FaqAccordion from '../components/FaqAccordion.vue'

useScrollReveal()

const { t, tm, locale } = useI18n()
const { user, isLoggedIn, refreshUser } = useAuth()
const userResources = useUserResourcesStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const activating = ref(false)

const qty = ref(1)
const unitPrice = 1.38

const totalPrice = computed(() => 'US$' + (qty.value * unitPrice).toFixed(2))

function changeQty(delta: number) {
  qty.value = Math.max(1, qty.value + delta)
}

async function activateVip(plan: string) {
  if (!isLoggedIn.value) {
    toast.error(t('auth.loginFirst'))
    void router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  activating.value = true
  try {
    const res = await api.post('/user/activate-vip', { plan })
    if (res.data.success) {
      toast.success(res.data.message || t('pages.membership.toastVipOk'))
      await refreshUser()
      await userResources.fetchQuota(true)
    } else {
      toast.error(res.data.message || t('pages.membership.toastActivateFail'))
    }
  } catch (err: any) {
    toast.error(err.response?.data?.message || t('pages.membership.toastActivateRetry'))
  } finally {
    activating.value = false
  }
}

const freeFeatures = computed(() => tm('pages.membership.freeFeatures') as string[])
const monthlyFeatures = computed(() => tm('pages.membership.monthlyFeatures') as string[])
const yearlyFeatures = computed(() => tm('pages.membership.yearlyFeatures') as string[])
const payPerUseFeatures = computed(() => tm('pages.membership.payPerUseFeatures') as string[])

const faqItems = computed(() => tm('pages.membership.faq') as { question: string; answer: string }[])
</script>

<template>
  <div class="relative z-10">
    <!-- Hero -->
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-12 text-center">
      <div class="animate-fade-in-up">
        <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold font-serif leading-tight mb-4">
          <span class="block text-white">{{ t('pages.membership.heroLine1') }}</span>
          <span class="block mt-2 text-gold-300">{{ t('pages.membership.heroLine2') }}</span>
        </h1>
        <p class="text-gray-400 text-lg mt-4">{{ t('pages.membership.heroSub') }}</p>
        <!-- VIP status -->
        <div v-if="user?.membership === 'vip'" class="mt-6 px-6 py-3 rounded-full bg-amber-500/20 border border-amber-500/30 inline-flex items-center gap-2">
          <span class="text-amber-400 font-medium">{{ t('pages.membership.vipBadge') }}</span>
          <span v-if="user.membershipExpiresAt" class="text-amber-300/70 text-sm">{{ t('pages.membership.expires', { date: new Date(user.membershipExpiresAt).toLocaleDateString(String(locale)) }) }}</span>
        </div>
      </div>
    </section>

    <!-- Pricing Cards -->
    <section class="w-full max-w-6xl mx-auto px-4 py-12 reveal-on-scroll">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Free -->
        <div class="price-card">
          <h3 class="text-lg font-bold font-serif text-white mb-2">{{ t('pages.membership.planFree') }}</h3>
          <div class="mb-4"><span class="text-3xl font-bold text-white">{{ t('pages.membership.priceFree') }}</span></div>
          <p class="text-gray-400 text-sm mb-6">{{ t('pages.membership.planFreeSub') }}</p>
          <ul class="space-y-3 mb-8">
            <li v-for="f in freeFeatures" :key="f" class="flex items-center gap-2 text-sm text-gray-300">
              <svg class="w-4 h-4 text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>{{ f }}
            </li>
          </ul>
          <button class="w-full py-3 rounded-full border border-gold-500/10 text-gray-300 font-semibold hover:bg-white/4 transition-all">{{ t('pages.membership.btnCurrent') }}</button>
        </div>

        <!-- Monthly - Featured -->
        <div class="price-card featured">
          <h3 class="text-lg font-bold font-serif text-white mb-2">{{ t('pages.membership.planMonthly') }}</h3>
          <div class="mb-4"><span class="text-3xl font-bold text-white">{{ t('pages.membership.priceMonthly') }}</span><span class="text-gray-400 text-sm">{{ t('pages.membership.perMonth') }}</span></div>
          <p class="text-gray-400 text-sm mb-6">{{ t('pages.membership.planMonthlySub') }}</p>
          <ul class="space-y-3 mb-8">
            <li v-for="f in monthlyFeatures" :key="f" class="flex items-center gap-2 text-sm text-gray-300">
              <svg class="w-4 h-4 text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>{{ f }}
            </li>
          </ul>
          <button
            :disabled="activating"
            class="w-full py-3 rounded-full cta-button text-white font-semibold hover:shadow-lg hover:shadow-gold-500/30 transition-all disabled:opacity-50"
            @click="activateVip('monthly')"
          >
            {{ activating ? t('pages.membership.activating') : t('pages.membership.btnSubscribe') }}
          </button>
        </div>

        <!-- Annual -->
        <div class="price-card">
          <div class="flex items-center gap-2 mb-2">
            <h3 class="text-lg font-bold font-serif text-white">{{ t('pages.membership.planYearly') }}</h3>
            <span class="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">{{ t('pages.membership.save25') }}</span>
          </div>
          <div class="mb-1"><span class="text-3xl font-bold text-white">{{ t('pages.membership.priceYearly') }}</span><span class="text-gray-400 text-sm">{{ t('pages.membership.perYear') }}</span></div>
          <p class="text-gray-500 text-xs mb-4">{{ t('pages.membership.subPriceYearly') }}</p>
          <p class="text-gray-400 text-sm mb-6">{{ t('pages.membership.planYearlySub') }}</p>
          <ul class="space-y-3 mb-8">
            <li v-for="f in yearlyFeatures" :key="f" class="flex items-center gap-2 text-sm text-gray-300">
              <svg class="w-4 h-4 text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>{{ f }}
            </li>
          </ul>
          <button
            :disabled="activating"
            class="w-full py-3 rounded-full cta-button text-white font-semibold hover:shadow-lg hover:shadow-gold-500/30 transition-all disabled:opacity-50"
            @click="activateVip('yearly')"
          >
            {{ activating ? t('pages.membership.activating') : t('pages.membership.btnSubscribe') }}
          </button>
        </div>

        <!-- Pay Per Use -->
        <div class="price-card">
          <h3 class="text-lg font-bold font-serif text-white mb-2">{{ t('pages.membership.planPayPer') }}</h3>
          <div class="mb-4"><span class="text-3xl font-bold text-white">{{ totalPrice }}</span><span class="text-gray-400 text-sm"> {{ t('pages.membership.totalLabel') }}</span></div>
          <p class="text-gray-400 text-sm mb-6">{{ t('pages.membership.planPaySub') }}</p>
          <ul class="space-y-3 mb-6">
            <li v-for="f in payPerUseFeatures" :key="f" class="flex items-center gap-2 text-sm text-gray-300">
              <svg class="w-4 h-4 text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>{{ f }}
            </li>
          </ul>
          <div class="flex items-center justify-center gap-4 mb-6">
            <button class="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors" @click="changeQty(-1)">-</button>
            <span class="text-white font-bold text-lg">{{ qty }}</span>
            <span class="text-gray-400 text-sm">{{ t('pages.membership.timesUnit') }}</span>
            <button class="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors" @click="changeQty(1)">+</button>
          </div>
          <button
            :disabled="activating"
            class="w-full py-3 rounded-full cta-button text-white font-semibold hover:shadow-lg hover:shadow-gold-500/30 transition-all disabled:opacity-50"
            @click="activateVip('monthly')"
          >
            {{ activating ? t('pages.membership.activating') : t('pages.membership.btnBuy') }}
          </button>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="w-full max-w-4xl mx-auto px-4 py-16 reveal-on-scroll">
      <div class="text-center mb-12"><h2 class="text-2xl font-bold font-serif text-white mb-4">{{ t('pages.membership.faqTitle') }}</h2></div>
      <FaqAccordion :items="faqItems" />
    </section>
  </div>
</template>
