<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useScrollReveal } from '../composables/useScrollReveal'
import { useAuth } from '../composables/useAuth'
import FaqAccordion from '../components/FaqAccordion.vue'
import api, { publicApi } from '../services/api'
import { isAxiosError } from 'axios'

useScrollReveal()

const { t, tm, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { user, isLoggedIn, refreshUser } = useAuth()
const isEnglish = computed(() => String(locale.value).toLowerCase().startsWith('en'))
const paymentDisabled = import.meta.env.VITE_PAYMENT_MODE === 'disabled'

type PlanCode = 'vip_monthly' | 'vip_yearly'
type PaymentPlan = { code: PlanCode; amountCents: number; currency: string }
type Subscription = { planCode: PlanCode; status: string; currentPeriodEndAt: string | null; canCancel: boolean }

const PUBLIC_PLAN_FALLBACKS: PaymentPlan[] = [
  { code: 'vip_monthly', amountCents: 990, currency: 'USD' },
  { code: 'vip_yearly', amountCents: 8990, currency: 'USD' },
]

const paymentAvailable = ref(false)
const plans = ref<PaymentPlan[]>(paymentDisabled ? [] : PUBLIC_PLAN_FALLBACKS.map((plan) => ({ ...plan })))
const plansLoading = ref(!paymentDisabled)
const plansError = ref('')
const selectedPlanCode = ref<PlanCode>('vip_yearly')
const checkoutLoading = ref<PlanCode | null>(null)
const checkoutError = ref('')
const subscription = ref<Subscription | null>(null)
const subscriptionLoading = ref(false)
const subscriptionError = ref('')
const cancelLoading = ref(false)
const cancellationMessage = ref('')
const paymentConfirmationMessage = ref('')
const paymentConfirmationType = ref<'pending' | 'success' | 'error'>('pending')
let disposed = false

const freeFeatures = computed(() => tm('pages.membership.freeFeatures') as string[])
const vipFeatures = computed(() => tm('pages.membership.vipFeatures') as string[])

const faqItems = computed(() => tm('pages.membership.faq') as { question: string; answer: string }[])

const isYearlySelected = computed(() => selectedPlanCode.value === 'vip_yearly')
const yearlySavingsPercent = computed(() => {
  const monthly = plans.value.find((item) => item.code === 'vip_monthly')
  const yearly = plans.value.find((item) => item.code === 'vip_yearly')
  if (!monthly || !yearly || monthly.amountCents <= 0) return 0
  return Math.max(0, Math.round((1 - yearly.amountCents / (monthly.amountCents * 12)) * 100))
})
const yearlySavingsLabel = computed(() => yearlySavingsPercent.value > 0
  ? t('pages.membership.savePercent', { percent: yearlySavingsPercent.value })
  : '')
const monthlyPlanPrice = computed(() => planPrice('vip_monthly') || formatPlanAmount(990, 'USD'))
const yearlyPlanPrice = computed(() => planPrice('vip_yearly') || formatPlanAmount(8990, 'USD'))
const displayedPrice = computed(() => paymentDisabled ? t('pages.membership.comingSoon') : selectedPrice.value)
const displayedPriceDetail = computed(() => paymentDisabled ? t('pages.membership.comingSoonSub') : selectedPriceDetail.value)

const selectedPrice = computed(() => {
  if (isYearlySelected.value) {
    const plan = plans.value.find((item) => item.code === 'vip_yearly')
    if (plan) return formatPlanAmount(Math.round(plan.amountCents / 12), plan.currency)
    return t('pages.membership.pricePending')
  }
  return planPrice('vip_monthly') || t('pages.membership.pricePending')
})

const selectedPriceDetail = computed(() => {
  if (isYearlySelected.value) {
    return t('pages.membership.billedYearly', {
      price: planPrice('vip_yearly') || t('pages.membership.pricePending'),
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

function requestErrorMessage(error: unknown, fallback: string) {
  if (isEnglish.value) return fallback
  if (isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || fallback
  return error instanceof Error && error.message ? error.message : fallback
}

async function loadPaymentPlans() {
  if (paymentDisabled) {
    paymentAvailable.value = false
    plans.value = []
    plansLoading.value = false
    plansError.value = ''
    return
  }
  plansLoading.value = true
  plansError.value = ''
  try {
    const res = await publicApi.get('/payments/plans')
    if (!res.data?.success) throw new Error(res.data?.message || t('pages.membership.plansLoadFailed'))
    paymentAvailable.value = Boolean(res.data.data?.enabled)
    const loadedPlans = Array.isArray(res.data.data?.plans) ? res.data.data.plans : []
    plans.value = loadedPlans.length ? loadedPlans : PUBLIC_PLAN_FALLBACKS.map((plan) => ({ ...plan }))
  } catch (error: unknown) {
    paymentAvailable.value = false
    plans.value = PUBLIC_PLAN_FALLBACKS.map((plan) => ({ ...plan }))
    plansError.value = requestErrorMessage(error, t('pages.membership.plansLoadFailed'))
  } finally {
    plansLoading.value = false
  }
}

async function startCheckout(planCode: PlanCode) {
  if (paymentDisabled) return
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
      throw new Error(isEnglish.value ? t('pages.membership.checkoutFailed') : (res.data?.message || t('pages.membership.checkoutFailed')))
    }
    window.location.assign(checkoutUrl)
  } catch (error: unknown) {
    checkoutError.value = requestErrorMessage(error, t('pages.membership.checkoutFailed'))
  } finally {
    checkoutLoading.value = null
  }
}

async function loadSubscription() {
  if (paymentDisabled) {
    subscription.value = null
    subscriptionError.value = ''
    return
  }
  if (!isLoggedIn.value) {
    subscription.value = null
    subscriptionError.value = ''
    return
  }
  subscriptionLoading.value = true
  subscriptionError.value = ''
  try {
    const res = await api.get('/payments/subscription')
    if (!res.data?.success) throw new Error(res.data?.message || t('pages.membership.subscriptionLoadFailed'))
    subscription.value = res.data.data
  } catch (error: unknown) {
    subscription.value = null
    subscriptionError.value = requestErrorMessage(error, t('pages.membership.subscriptionLoadFailed'))
  } finally {
    subscriptionLoading.value = false
  }
}

async function cancelRenewal() {
  if (paymentDisabled) return
  if (!subscription.value?.canCancel || cancelLoading.value) return
  if (!window.confirm(t('pages.membership.cancelConfirm'))) return
  cancelLoading.value = true
  cancellationMessage.value = ''
  try {
    const res = await api.post('/payments/subscription/cancel')
    if (!res.data?.success) throw new Error(isEnglish.value ? t('pages.membership.cancelFailed') : (res.data?.message || t('pages.membership.cancelFailed')))
    subscription.value = subscription.value ? { ...subscription.value, status: 'scheduled_cancel', canCancel: false } : null
    cancellationMessage.value = res.data?.message || t('pages.membership.cancelled')
  } catch (error: unknown) {
    cancellationMessage.value = (error as { response?: { data?: { message?: string } }; message?: string })
      .response?.data?.message || (error as Error).message || t('pages.membership.cancelFailed')
  } finally {
    cancelLoading.value = false
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function confirmReturnedPayment(orderId: string) {
  if (!isLoggedIn.value) {
    paymentConfirmationType.value = 'pending'
    paymentConfirmationMessage.value = t('pages.membership.paymentSignInToConfirm')
    return
  }

  paymentConfirmationType.value = 'pending'
  paymentConfirmationMessage.value = t('pages.membership.paymentConfirming')
  for (let attempt = 0; attempt < 8 && !disposed; attempt += 1) {
    try {
      const res = await api.get(`/payments/orders/${encodeURIComponent(orderId)}`)
      const state = res.data?.data?.state
      if (state === 'active') {
        await Promise.all([refreshUser(), loadSubscription()])
        paymentConfirmationType.value = 'success'
        paymentConfirmationMessage.value = t('pages.membership.paymentConfirmed')
        return
      }
      if (state === 'failed' || state === 'refunded' || state === 'disputed') {
        paymentConfirmationType.value = 'error'
        paymentConfirmationMessage.value = t('pages.membership.paymentNotActivated')
        return
      }
    } catch (error: unknown) {
      if (attempt === 7) {
        paymentConfirmationType.value = 'error'
        paymentConfirmationMessage.value = requestErrorMessage(error, t('pages.membership.paymentStatusFailed'))
        return
      }
    }
    await delay(1500)
  }

  if (!disposed) {
    paymentConfirmationType.value = 'pending'
    paymentConfirmationMessage.value = t('pages.membership.paymentPending')
  }
}

onMounted(async () => {
  if (paymentDisabled) return
  await loadPaymentPlans()
  const orderId = typeof route.query.orderId === 'string' ? route.query.orderId : ''
  if (route.query.payment === 'success' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    await confirmReturnedPayment(orderId)
  }
  await loadSubscription()
})

onBeforeUnmount(() => {
  disposed = true
})
</script>

<template>
  <div class="membership-page relative z-10">
    <section class="membership-pricing-intro w-full max-w-6xl mx-auto px-4 pt-5 pb-5 sm:pt-8 sm:pb-6">
      <div class="animate-fade-in-up membership-pricing-heading">
        <span class="membership-kicker">{{ t('pages.membership.heroLine1') }}</span>
        <h1 class="membership-title">{{ t('pages.membership.plansTitle') }}</h1>
        <p class="membership-subtitle">{{ t('pages.membership.heroSub') }}</p>

        <div v-if="!paymentDisabled" class="membership-cycle-control" role="radiogroup" :aria-label="t('pages.membership.billingCycleLabel')">
          <button
            type="button"
            role="radio"
            class="membership-cycle-option"
            :class="{ active: !isYearlySelected }"
            :aria-checked="!isYearlySelected"
            @click="selectPlan('vip_monthly')"
          >
            <span class="membership-cycle-option-copy">
              <span>{{ t('pages.membership.planMonthly') }}</span>
              <small>{{ monthlyPlanPrice }}{{ t('pages.membership.perMonth') }}</small>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            class="membership-cycle-option membership-cycle-option-yearly"
            :class="{ active: isYearlySelected }"
            :aria-checked="isYearlySelected"
            @click="selectPlan('vip_yearly')"
          >
            <span class="membership-cycle-option-copy">
              <span>{{ t('pages.membership.planYearly') }}</span>
              <small>{{ yearlyPlanPrice }}{{ t('pages.membership.perYear') }}</small>
            </span>
            <span v-if="yearlySavingsLabel" class="membership-saving-badge">{{ yearlySavingsLabel }}</span>
          </button>
        </div>
        <p class="membership-trust-note">{{ paymentDisabled ? t('pages.membership.comingSoonSub') : t('pages.membership.billingNote') }}</p>
      </div>
    </section>

    <section id="membership-plans" class="w-full max-w-6xl mx-auto px-4 pb-10 sm:pb-12 reveal-on-scroll">
      <div v-if="plansLoading" class="membership-load-state" role="status" aria-live="polite">
        {{ t('pages.membership.plansLoading') }}
      </div>
      <div v-else-if="plansError" class="membership-load-state membership-load-state-error" role="alert">
        <span>{{ plansError }}</span>
        <button type="button" class="membership-text-button" @click="loadPaymentPlans">{{ t('pages.membership.retry') }}</button>
      </div>

      <div v-if="subscriptionLoading" class="membership-load-state" role="status" aria-live="polite">
        {{ t('pages.membership.subscriptionLoading') }}
      </div>
      <div v-else-if="subscriptionError" class="membership-load-state membership-load-state-error" role="alert">
        <span>{{ subscriptionError }}</span>
        <button type="button" class="membership-text-button" @click="loadSubscription">{{ t('pages.membership.retry') }}</button>
      </div>

      <div
        v-if="paymentConfirmationMessage"
        class="membership-load-state"
        :class="{
          'membership-load-state-error': paymentConfirmationType === 'error',
          'text-emerald-300': paymentConfirmationType === 'success',
        }"
        role="status"
        aria-live="polite"
      >
        {{ paymentConfirmationMessage }}
      </div>

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
            <p>{{ displayedPriceDetail }}</p>
          </div>
          <div class="membership-price-row membership-price-row-vip">
            <strong>{{ displayedPrice }}</strong>
            <span v-if="!paymentDisabled">{{ t('pages.membership.perMonth') }}</span>
          </div>
          <div class="membership-price-context">
            <span v-if="!paymentDisabled && isYearlySelected && yearlySavingsLabel">{{ yearlySavingsLabel }}</span>
            <span>{{ paymentDisabled ? t('pages.membership.comingSoonSub') : (isYearlySelected ? t('pages.membership.planYearlySub') : t('pages.membership.planMonthlySub')) }}</span>
          </div>
          <ul class="membership-feature-list membership-feature-list-vip">
            <li v-for="f in vipFeatures" :key="f"><span class="membership-check" aria-hidden="true">✓</span>{{ f }}</li>
          </ul>
          <button
            v-if="plansLoading"
            type="button"
            disabled
            class="membership-plan-unavailable"
          >
            {{ t('pages.membership.plansLoading') }}
          </button>
          <button
            v-else-if="paymentAvailable"
            type="button"
            class="membership-primary-cta"
            :disabled="checkoutLoading !== null"
            @click="startCheckout(selectedPlanCode)"
          >
            {{ checkoutLoading === selectedPlanCode
              ? t('pages.membership.creatingCheckout')
              : isLoggedIn
                ? t('pages.membership.btnSubscribe')
                : t('pages.membership.signInToSubscribe') }}
          </button>
          <button v-else type="button" disabled class="membership-plan-unavailable">{{ t('pages.membership.purchaseUnavailable') }}</button>
          <p v-if="checkoutError" class="membership-checkout-error">{{ checkoutError }}</p>
        </article>
      </div>

      <p class="membership-payment-note" aria-live="polite">
        {{ paymentDisabled
          ? t('pages.membership.comingSoonSub')
          : plansLoading
            ? t('pages.membership.plansLoading')
            : plansError
              ? t('pages.membership.plansLoadFailed')
              : paymentAvailable
                ? t('pages.membership.paymentNotice')
                : t('pages.membership.availabilityNotice') }}
      </p>
      <div v-if="!paymentDisabled" class="mx-auto mt-4 max-w-3xl text-center text-xs leading-relaxed text-gray-500">
        <p>{{ t('pages.membership.purchaseDisclosure') }}</p>
        <p class="mt-2">
          <RouterLink to="/terms" class="text-gold-400 hover:text-gold-300">{{ t('pages.membership.termsLink') }}</RouterLink>
          <span aria-hidden="true"> / </span>
          <RouterLink to="/privacy" class="text-gold-400 hover:text-gold-300">{{ t('pages.membership.privacyLink') }}</RouterLink>
          <span aria-hidden="true"> / </span>
          <RouterLink to="/refund-policy" class="text-gold-400 hover:text-gold-300">{{ t('pages.membership.refundLink') }}</RouterLink>
        </p>
      </div>
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
