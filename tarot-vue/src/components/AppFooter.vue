<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../services/api'

const { t } = useI18n()

const subscribeEmail = ref('')
const subscribed = ref(false)
const subscribing = ref(false)

async function handleSubscribe() {
  const email = subscribeEmail.value.trim()
  if (!email || !email.includes('@') || subscribing.value) return
  subscribing.value = true
  try {
    await api.post('/feedback', {
      type: 'suggestion',
      content: `邮箱订阅请求: ${email}`,
      contact: email,
    })
    subscribed.value = true
    subscribeEmail.value = ''
    setTimeout(() => { subscribed.value = false }, 3000)
  } catch {
    subscribed.value = false
  } finally {
    subscribing.value = false
  }
}
</script>

<template>
  <footer class="relative z-10 border-t border-gold-500/10 bg-abyss/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)]">
    <!-- Gold divider line -->
    <div class="section-divider"></div>

    <div class="max-w-6xl mx-auto px-6 py-12">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
        <!-- Brand & Subscribe -->
        <div>
          <p class="text-lg font-serif text-gold-300 tracking-wider mb-2">E-Tomd</p>
          <p class="text-gray-600 text-sm mb-4 leading-relaxed">{{ t('footer.copyrightLine') }}</p>
          <div class="flex gap-2">
            <input
              v-model="subscribeEmail"
              type="email"
              autocomplete="email"
              :placeholder="t('footer.emailPlaceholder')"
              :aria-label="t('footer.subscribeEmailAria')"
              class="flex-1 min-w-0 px-4 py-2 rounded-lg bg-white/4 border border-gold-500/10 text-white text-sm placeholder:text-stone-500/80 focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 transition-colors"
            >
            <button
              type="button"
              class="shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss"
              :class="subscribed
                ? 'bg-emerald-600 text-white'
                : 'bg-gold-500/15 text-gold-300 hover:bg-gold-500/25 border border-gold-500/20'"
              :disabled="subscribing"
              @click="handleSubscribe"
            >
              {{ subscribed ? t('footer.subscribed') : subscribing ? t('footer.subscribing') : t('footer.subscribe') }}
            </button>
          </div>
        </div>

        <!-- About -->
        <div>
          <h3 class="text-gold-200 font-serif text-sm mb-4 tracking-wide">{{ t('footer.about') }}</h3>
          <ul class="space-y-2">
            <li><RouterLink to="/privacy" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('footer.privacy') }}</RouterLink></li>
            <li><RouterLink to="/terms" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('footer.terms') }}</RouterLink></li>
            <li><RouterLink to="/feedback" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('footer.feedback') }}</RouterLink></li>
            <li><a href="mailto:contact@e-tomd.com" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('footer.contactEmail') }}</a></li>
          </ul>
        </div>

        <!-- Features -->
        <div>
          <h3 class="text-gold-200 font-serif text-sm mb-4 tracking-wide">{{ t('footer.features') }}</h3>
          <ul class="space-y-2">
            <li><RouterLink to="/" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.home') }}</RouterLink></li>
            <li><RouterLink to="/tarot" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.tarot') }}</RouterLink></li>
            <li><RouterLink to="/daily-fortune" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.daily') }}</RouterLink></li>
            <li><RouterLink to="/yes-no-tarot" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.yesNo') }}</RouterLink></li>
            <li><RouterLink to="/horoscope" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.horoscope') }}</RouterLink></li>
            <li><RouterLink to="/membership" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.membership') }}</RouterLink></li>
            <li><RouterLink to="/oracle-gallery" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.oracleGallery') }}</RouterLink></li>
          </ul>
        </div>

        <!-- Blog -->
        <div>
          <h3 class="text-gold-200 font-serif text-sm mb-4 tracking-wide">{{ t('footer.explore') }}</h3>
          <ul class="space-y-2">
            <li><RouterLink to="/gallery" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.gallery') }}</RouterLink></li>
            <li><RouterLink to="/spreads" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.spreads') }}</RouterLink></li>
          </ul>
        </div>
      </div>

      <div class="text-center text-gray-700 text-xs pt-4 border-t border-gold-500/6">
        <p>E-Tomd</p>
      </div>
    </div>
  </footer>
</template>
