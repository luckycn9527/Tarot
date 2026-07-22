<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useScrollReveal } from '../composables/useScrollReveal'
import { useAuth } from '../composables/useAuth'
import FaqAccordion from '../components/FaqAccordion.vue'
import api from '../services/api'

useScrollReveal()

const { t, tm, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { user, isLoggedIn, refreshUser } = useAuth()

type PlanCode = 'vip_monthly' | 'vip_yearly'
type PaymentPlan = { code: PlanCode; amountCents: number; currency: string }
type Subscription = { planCode: PlanCode; status: string; currentPeriodEndAt: string | null; canCancel: boolean }

const paymentAvailable = ref(false)
const plans = ref<PaymentPlan[]>([])
const selectedPlanCode = ref<PlanCode>('vip_yearly')
const checkoutLoading = ref<PlanCode | null>(null)
const checkoutError = ref('')
const subscription = ref<Subscription | null>(null)
const cancelLoading = ref(false)
const cancellationMessage = ref('')

const freeFeatures = computed(() => tm('pages.membership.freeFeatures') as string[])
const vipFeatures = computed(() => tm('pages.membership.vipFeatures') as string[])

const faqItems = computed(() => tm('pages.membership.faq') as { question: string; answer: string }[])

const isYearlySelected = computed(() => selectedPlanCode.value === 'vip_yearly')

const selectedPrice = computed(() => {
  if (isYearlySelected.value) {
    const plan = plans.value.find((item) => item.code === 'vip_yearly')
    if (plan) return formatPlanAmount(Math.round(plan.amountCents / 12), plan.currency)
    return t('pages.membership.priceYearlyMonthly')
  }
  return planPrice('vip_monthly') || t('pages.membership.priceMonthly')
})

const selectedPriceDetail = computed(() => {
  if (isYearlySelected.value) {
    return t('pages.membership.billedYearly', {
      price: planPrice('vip_yearly') || t('pages.membership.priceYearly'),
    })
  }
  return t('pages.membership.planMonthlySub')
})

const vipStatusText = computed(() => {
  if (user.value?.membership !== 'vip') return ''
  if (!user.value.membershipExpiresAt) return t('pages.membership.lifetime')
  return t('pages.membership.expires', {
    date: new Date(user.value.membershipExpiresAt).toLocaleDateString(String(locale.value)),
  })
})

function formatPlanAmount(amountCents: number, currency: string) {
  return new Intl.NumberFormat(String(locale.value), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100)
}

function planPrice(planCode: PlanCode) {
  const plan = plans.value.find((item) => item.code === planCode)
  if (!plan) return ''
  return formatPlanAmount(plan.amountCents, plan.currency)
}

function selectPlan(planCode: PlanCode) {
  selectedPlanCode.value = planCode
  checkoutError.value = ''
}

async function startCheckout(planCode: PlanCode) {
  checkoutError.value = ''
  if (!isLoggedIn.value) {
    await router.push({ path: '/login', query: { redirect: '/membership' } })
    return
  }
  checkoutLoading.value = planCode
  try {
    const res = await api.post('/payments/checkout', { planCode })
    const checkoutUrl = res.data?.data?.checkoutUrl
    if (!res.data?.success || typeof checkoutUrl !== 'string') {
      throw new Error(res.data?.message || '无法创建支付订单')
    }
    window.location.assign(checkoutUrl)
  } catch (error: unknown) {
    checkoutError.value = (error as { response?: { data?: { message?: string } }; message?: string })
      .response?.data?.message || (error as Error).message || '无法创建支付订单，请稍后再试'
  } finally {
    checkoutLoading.value = null
  }
}

async function loadSubscription() {
  if (!isLoggedIn.value) return
  try {
    const res = await api.get('/payments/subscription')
    subscription.value = res.data?.success ? res.data.data : null
  } catch {
    subscription.value = null
  }
}

async function cancelRenewal() {
  if (!subscription.value?.canCancel || cancelLoading.value) return
  if (!window.confirm(t('pages.membership.cancelConfirm'))) return
  cancelLoading.value = true
  cancellationMessage.value = ''
  try {
    const res = await api.post('/payments/subscription/cancel')
    if (!res.data?.success) throw new Error(res.data?.message || '取消自动续费失败')
    subscription.value = subscription.value ? { ...subscription.value, status: 'scheduled_cancel', canCancel: false } : null
    cancellationMessage.value = res.data?.message || t('pages.membership.cancelled')
  } catch (error: unknown) {
    cancellationMessage.value = (error as { response?: { data?: { message?: string } }; message?: string })
      .response?.data?.message || (error as Error).message || t('pages.membership.cancelFailed')
  } finally {
    cancelLoading.value = false
  }
}

onMounted(async () => {
  try {
    const res = await api.get('/payments/plans')
    if (res.data?.success) {
      paymentAvailable.value = Boolean(res.data.data?.enabled)
      plans.value = Array.isArray(res.data.data?.plans) ? res.data.data.plans : []
    }
  } catch {
    paymentAvailable.value = false
  }
  if (route.query.payment === 'success') {
    await refreshUser()
  }
  await loadSubscription()
})
</script>

<template>
  <div class="membership-page relative z-10">
    <section class="membership-pricing-intro w-full max-w-6xl mx-auto px-4 pt-5 pb-5 sm:pt-8 sm:pb-6">
      <div class="animate-fade-in-up membership-pricing-heading">
        <span class="membership-kicker">{{ t('pages.membership.heroLine1') }}</span>
        <h1 class="membership-title">{{ t('pages.membership.plansTitle') }}</h1>
        <p class="membership-subtitle">{{ t('pages.membership.heroSub') }}</p>

        <div class="membership-cycle-control" role="radiogroup" :aria-label="t('pages.membership.billingCycleLabel')">
          <button
            type="button"
            role="radio"
            class="membership-cycle-option"
            :class="{ active: !isYearlySelected }"
            :aria-checked="!isYearlySelected"
            @click="selectPlan('vip_monthly')"
          >
            {{ t('pages.membership.planMonthly') }}
          </button>
          <button
            type="button"
            role="radio"
            class="membership-cycle-option membership-cycle-option-yearly"
            :class="{ active: isYearlySelected }"
            :aria-checked="isYearlySelected"
            @click="selectPlan('vip_yearly')"
          >
            {{ t('pages.membership.planYearly') }}
            <span class="membership-saving-badge">{{ t('pages.membership.save25') }}</span>
          </button>
        </div>
        <p class="membership-trust-note">{{ t('pages.membership.billingNote') }}</p>
      </div>
    </section>

    <section id="membership-plans" class="w-full max-w-6xl mx-auto px-4 pb-10 sm:pb-12 reveal-on-scroll">
      <div v-if="user?.membership === 'vip' || subscription" class="membership-account-bar" aria-live="polite">
        <div>
          <span class="membership-account-label">{{ t('pages.membership.statusLabel') }}</span>
          <strong>{{ user?.membership === 'vip' ? t('pages.membership.vipBadge') : t('pages.membership.planFree') }}</strong>
          <span>{{ user?.membership === 'vip' ? vipStatusText : t('pages.membership.freeStatus') }}</span>
        </div>
        <div v-if="subscription" class="membership-account-action">
          <button
            v-if="subscription.canCancel"
            type="button"
            class="membership-text-button"
            :disabled="cancelLoading"
            @click="cancelRenewal"
          >
            {{ cancelLoading ? t('pages.membership.cancelling') : t('pages.membership.cancelRenewal') }}
          </button>
          <span v-else-if="subscription.status === 'scheduled_cancel'" class="membership-status-warning">{{ t('pages.membership.renewalCancelled') }}</span>
          <p v-if="cancellationMessage" class="membership-status-message" :class="subscription?.status === 'scheduled_cancel' ? 'success' : 'error'">{{ cancellationMessage }}</p>
        </div>
      </div>

      <div class="membership-plans-grid">
        <article class="membership-pricing-card membership-pricing-card-free">
          <div class="membership-plan-card-header">
            <span class="membership-plan-label">{{ t('pages.membership.planFree') }}</span>
            <h2>{{ t('pages.membership.planFreeSub') }}</h2>
            <p>{{ t('pages.membership.freeStatus') }}</p>
          </div>
          <div class="membership-price-row">
            <strong>{{ t('pages.membership.priceZero') }}</strong>
            <span>{{ t('pages.membership.perMonth') }}</span>
          </div>
          <ul class="membership-feature-list">
            <li v-for="f in freeFeatures" :key="f"><span class="membership-check" aria-hidden="true">✓</span>{{ f }}</li>
          </ul>
          <button type="button" class="membership-plan-secondary" disabled>{{ t('pages.membership.btnCurrent') }}</button>
        </article>

        <article class="membership-pricing-card membership-pricing-card-vip">
          <span class="membership-featured-badge">{{ t('pages.membership.featuredBadge') }}</span>
          <div class="membership-plan-card-header">
            <span class="membership-plan-label">{{ t('pages.membership.planVip') }}</span>
            <h2>{{ t('pages.membership.planVipSub') }}</h2>
            <p>{{ selectedPriceDetail }}</p>
          </div>
          <div class="membership-price-row membership-price-row-vip">
            <strong>{{ selectedPrice }}</strong>
            <span>{{ t('pages.membership.perMonth') }}</span>
          </div>
          <div class="membership-price-context">
            <span v-if="isYearlySelected">{{ t('pages.membership.save25') }}</span>
            <span>{{ isYearlySelected ? t('pages.membership.planYearlySub') : t('pages.membership.planMonthlySub') }}</span>
          </div>
          <ul class="membership-feature-list membership-feature-list-vip">
            <li v-for="f in vipFeatures" :key="f"><span class="membership-check" aria-hidden="true">✓</span>{{ f }}</li>
          </ul>
          <button
            v-if="paymentAvailable"
            type="button"
            class="membership-primary-cta"
            :disabled="checkoutLoading !== null"
            @click="startCheckout(selectedPlanCode)"
          >
            {{ checkoutLoading === selectedPlanCode ? t('pages.membership.creatingCheckout') : t('pages.membership.btnSubscribe') }}
          </button>
          <button v-else type="button" disabled class="membership-plan-unavailable">{{ t('pages.membership.purchaseUnavailable') }}</button>
          <p v-if="checkoutError" class="membership-checkout-error">{{ checkoutError }}</p>
        </article>
      </div>

      <p class="membership-payment-note">{{ paymentAvailable ? t('pages.membership.paymentNotice') : t('pages.membership.availabilityNotice') }}</p>
    </section>

    <section class="membership-faq-section w-full max-w-4xl mx-auto px-4 py-12 sm:py-16 reveal-on-scroll">
      <div class="membership-section-heading membership-section-heading-centered">
        <div>
          <span class="membership-kicker">{{ t('pages.membership.faqKicker') }}</span>
          <h2>{{ t('pages.membership.faqTitle') }}</h2>
        </div>
      </div>
      <FaqAccordion :items="faqItems" />
    </section>
  </div>
</template>
