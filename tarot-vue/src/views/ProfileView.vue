<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Camera from '@icons/camera.vue'
import SquarePen from '@icons/square-pen.vue'
import ChevronRight from '@icons/chevron-right.vue'
import History from '@icons/history.vue'
import Images from '@icons/images.vue'
import MessageSquare from '@icons/message-square.vue'
import LogOut from '@icons/log-out.vue'
import House from '@icons/house.vue'
import Ticket from '@icons/ticket.vue'
import UserRound from '@icons/user-round.vue'
import Calendar from '@icons/calendar.vue'
import LoaderCircle from '@icons/loader-circle.vue'
import Upload from '@icons/upload.vue'
import Sparkles from '@icons/sparkles.vue'
import Crown from '@icons/crown.vue'
import { useAuth } from '../composables/useAuth'
import { useQuota } from '../composables/useQuota'
import api from '../services/api'
import { publicAssetUrl } from '../utils/publicAssetUrl'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const { user, isLoggedIn, isInitialized, logout, updateProfile, uploadAvatar, refreshUser } = useAuth()
const { remaining, isVip, fetchQuota } = useQuota()

const showAvatarPicker = ref(false)
const editingNickname = ref(false)
const nicknameInput = ref('')
const nicknameError = ref('')

// Editable fields
const editingField = ref<string | null>(null)
const editValue = ref('')

const invitationCode = ref('')
const invitationMsg = ref('')
const invitationSuccess = ref(false)

// Avatar upload
const avatarUploading = ref(false)
const avatarError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const avatarOptions = ['🔮', '🌙', '⭐', '🌟', '✨', '🃏', '🎴', '🧿']

// Birth info (dedicated API)
const birthBirthday = ref<string | null>(null)
const birthZodiac = ref<string | null>(null)
const birthDateInput = ref('')
const birthLoading = ref(false)
const birthSaving = ref(false)
const birthMsg = ref('')
const birthMsgType = ref<'success' | 'error'>('success')

async function fetchBirthInfo() {
  birthLoading.value = true
  try {
    const res = await api.get('/user/birth-info')
    if (res.data.success) {
      birthBirthday.value = res.data.data.birthday
      birthZodiac.value = res.data.data.zodiacSign
      birthDateInput.value = res.data.data.birthday?.slice(0, 10) || ''
    }
  } catch {
    /* ignore */
  } finally {
    birthLoading.value = false
  }
}

async function saveBirthInfo() {
  birthSaving.value = true
  birthMsg.value = ''
  try {
    const res = await api.put('/user/birth-info', {
      birthday: birthDateInput.value || null,
    })
    if (res.data.success) {
      birthBirthday.value = res.data.data.birthday
      birthZodiac.value = res.data.data.zodiacSign
      birthDateInput.value = res.data.data.birthday?.slice(0, 10) || ''
      birthMsg.value = t('pages.profile.birthSaved')
      birthMsgType.value = 'success'
      // Sync auth store user
      await refreshUser()
    }
  } catch (err: any) {
    birthMsg.value = err.response?.data?.message || t('pages.profile.birthSaveFail')
    birthMsgType.value = 'error'
  } finally {
    birthSaving.value = false
  }
}

async function clearBirthInfo() {
  birthSaving.value = true
  birthMsg.value = ''
  try {
    const res = await api.put('/user/birth-info', { birthday: null })
    if (res.data.success) {
      birthBirthday.value = null
      birthZodiac.value = null
      birthDateInput.value = ''
      birthMsg.value = t('pages.profile.birthCleared')
      birthMsgType.value = 'success'
      await refreshUser()
    }
  } catch (err: any) {
    birthMsg.value = err.response?.data?.message || t('pages.profile.birthClearFail')
    birthMsgType.value = 'error'
  } finally {
    birthSaving.value = false
  }
}

function genderLabel(g: string | undefined) {
  if (g === 'male') return t('pages.profile.genderMale')
  if (g === 'female') return t('pages.profile.genderFemale')
  if (g === 'other') return t('pages.profile.genderOther')
  return t('pages.profile.genderUnset')
}

const membershipExpiry = computed(() => {
  if (user.value?.membership === 'vip' && user.value.membershipExpiresAt) {
    return new Date(user.value.membershipExpiresAt).toLocaleDateString(String(locale.value))
  }
  return t('pages.profile.membershipInactive')
})

// Format birthday for display
const formattedBirthday = computed(() => {
  if (!user.value?.birthday) return ''
  try {
    return new Date(user.value.birthday).toLocaleDateString(String(locale.value), { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return user.value.birthday
  }
})

// Determine if avatar is a URL/path or emoji
const isImageAvatar = computed(() => {
  if (!user.value?.avatar) return false
  return user.value.avatar.startsWith('/') || user.value.avatar.startsWith('http')
})

const avatarImageSrc = computed(() => publicAssetUrl(user.value?.avatar))

watch(
  [isInitialized, isLoggedIn],
  ([init, logged]) => {
    if (!init) return
    if (!logged) {
      void router.replace({ path: '/login', query: { redirect: route.fullPath } })
      return
    }
    void fetchQuota()
    void fetchBirthInfo()
  },
  { immediate: true },
)

function startEditNickname() {
  if (!user.value) return
  nicknameInput.value = user.value.nickname
  nicknameError.value = ''
  editingNickname.value = true
}

async function saveNickname() {
  nicknameError.value = ''
  const result = await updateProfile({ nickname: nicknameInput.value })
  if (result) {
    nicknameError.value = result.message
  } else {
    editingNickname.value = false
  }
}

function cancelEditNickname() {
  editingNickname.value = false
  nicknameError.value = ''
}

async function selectAvatar(emoji: string) {
  await updateProfile({ avatar: emoji })
  showAvatarPicker.value = false
}

function triggerFileUpload() {
  fileInput.value?.click()
}

async function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // Client-side validation
  if (file.size > 2 * 1024 * 1024) {
    avatarError.value = t('pages.profile.avatarTooBig')
    return
  }
  if (!/^image\/(jpeg|png|gif|webp)$/.test(file.type)) {
    avatarError.value = t('pages.profile.avatarType')
    return
  }

  avatarError.value = ''
  avatarUploading.value = true
  const result = await uploadAvatar(file)
  avatarUploading.value = false

  if (result) {
    avatarError.value = result.message
  } else {
    showAvatarPicker.value = false
  }

  // Reset input so same file can be re-selected
  target.value = ''
}

function startEdit(field: string, currentValue: string | null) {
  editingField.value = field
  editValue.value = currentValue || ''
}

async function saveField(field: string) {
  const data: Record<string, any> = {}
  data[field] = editValue.value || null
  await updateProfile(data)
  editingField.value = null
}

function cancelEdit() {
  editingField.value = null
}

async function saveGender(value: string) {
  await updateProfile({ gender: value })
  editingField.value = null
}

async function redeemInvitation() {
  if (!invitationCode.value.trim()) return
  invitationMsg.value = ''
  try {
    const res = await api.post('/invitations/redeem', { code: invitationCode.value.trim() })
    if (res.data.success) {
      invitationMsg.value = res.data.message || t('pages.profile.redeemOk')
      invitationSuccess.value = true
      invitationCode.value = ''
      fetchQuota(true)
    } else {
      invitationMsg.value = res.data.message || t('pages.profile.redeemFail')
      invitationSuccess.value = false
    }
  } catch (err: any) {
    invitationMsg.value = err.response?.data?.message || t('pages.profile.redeemFail')
    invitationSuccess.value = false
  }
}

async function handleLogout() {
  await logout()
  router.push('/')
}
</script>

<template>
  <div v-if="user" class="profile-page relative z-10 min-h-[calc(100vh-56px)] px-4 sm:px-6 lg:px-10 pt-20 sm:pt-24 pb-20 sm:pb-24">
    <div class="max-w-6xl mx-auto w-full animate-fade-in-up">
      <header class="mb-8 sm:mb-12 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 text-center lg:text-left">
        <div class="max-w-2xl mx-auto lg:mx-0">
          <p class="text-gold-500/50 text-[11px] font-serif tracking-[0.22em] uppercase mb-2">{{ t('pages.profile.eyebrow') }}</p>
          <h1 class="text-2xl sm:text-3xl lg:text-[2rem] font-serif font-bold text-gold-100 tracking-tight">{{ t('pages.profile.title') }}</h1>
          <p class="text-gray-500 text-sm mt-2 leading-relaxed">
            {{ t('pages.profile.subtitle') }}
          </p>
        </div>
        <div class="hidden lg:block section-divider w-32 shrink-0 opacity-60 mb-1" aria-hidden="true" />
      </header>

      <!-- Profile Header Card -->
      <div class="card-glass rounded-2xl p-6 sm:p-8 lg:p-10 mb-8 lg:mb-10 profile-hero-card overflow-hidden">
        <div class="flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 xl:gap-10 lg:items-start">
          <!-- Avatar -->
          <div class="relative group shrink-0 flex justify-center lg:justify-start lg:col-span-3">
            <button
              type="button"
              class="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center border-2 border-gold-500/45 hover:border-gold-300/90 ring-2 ring-transparent hover:ring-gold-500/15 transition-all overflow-hidden shadow-lg shadow-black/30"
              :class="isImageAvatar ? 'bg-abyss/30' : 'bg-white/5 text-5xl sm:text-6xl'"
              :title="t('pages.profile.changeAvatarTitle')"
              :aria-label="t('pages.profile.changeAvatarAria')"
              @click="showAvatarPicker = !showAvatarPicker"
            >
              <img v-if="isImageAvatar" :src="avatarImageSrc" :alt="t('pages.profile.avatarAlt')" class="w-full h-full object-cover" />
              <span v-else>{{ user.avatar }}</span>
            </button>
            <!-- Camera overlay -->
            <div
              class="absolute inset-0 rounded-full bg-abyss/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              role="presentation"
              @click="showAvatarPicker = !showAvatarPicker"
            >
              <Camera class="w-6 h-6 text-white" :size="24" />
            </div>
          </div>

          <!-- User Info -->
          <div class="min-w-0 w-full text-center lg:col-span-6 lg:text-left">
            <div class="flex items-center justify-center lg:justify-start gap-2 mb-2 flex-wrap">
              <template v-if="editingNickname">
                <input
                  v-model="nicknameInput"
                  class="bg-white/8 border border-gold-500/20 rounded-xl text-white text-lg font-bold font-serif py-2 px-3 max-w-[220px] focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                  :aria-label="t('pages.profile.nicknameAria')"
                  @keyup.enter="saveNickname"
                  @keyup.escape="cancelEditNickname"
                  autofocus
                >
                <button type="button" class="text-emerald-400/90 hover:text-emerald-300 text-sm font-medium px-1" @click="saveNickname">{{ t('pages.profile.save') }}</button>
                <button type="button" class="text-gray-500 hover:text-gray-300 text-sm px-1" @click="cancelEditNickname">{{ t('pages.profile.cancel') }}</button>
              </template>
              <template v-else>
                <h2 class="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight">{{ user.nickname }}</h2>
                <button type="button" class="p-1.5 rounded-lg text-gray-500 hover:text-gold-400 hover:bg-white/5 transition-colors" :title="t('pages.profile.editNicknameTitle')" :aria-label="t('pages.profile.editNicknameAria')" @click="startEditNickname">
                  <SquarePen class="w-4 h-4" :size="16" />
                </button>
              </template>
            </div>
            <p v-if="nicknameError" class="text-red-400 text-xs mb-1">{{ nicknameError }}</p>

            <p class="text-gray-400 text-sm mb-3 break-all">{{ user.email }}</p>

            <div class="flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3 lg:hidden">
              <span
                v-if="!isVip"
                class="px-3 py-1.5 rounded-full text-xs font-medium bg-white/6 text-gray-300 border border-gold-500/15"
              >
                {{ t('pages.profile.tierFree') }}
              </span>
              <span v-if="!isVip" class="text-gray-500 text-xs sm:text-sm">
                {{ t('pages.profile.readsLeft', { count: remaining }) }}
              </span>
              <span v-if="isVip" class="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-200 border border-amber-400/25">
                {{ t('pages.profile.tierVip') }}
              </span>
            </div>
          </div>

          <!-- Desktop: 会员 / 额度摘要 -->
          <aside class="hidden lg:flex lg:col-span-3 w-full flex-col profile-hero-aside rounded-2xl border border-gold-500/12 bg-white/[0.03] p-4 xl:p-5">
            <p class="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-600 mb-3">{{ t('pages.profile.heroAccountLabel') }}</p>
            <div class="flex items-start gap-3">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-400/20 text-amber-300/90">
                <Crown v-if="isVip" :size="20" />
                <Sparkles v-else :size="20" />
              </span>
              <div class="min-w-0 flex-1 space-y-2">
                <span
                  v-if="!isVip"
                  class="inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-white/6 text-gray-300 border border-gold-500/15"
                >{{ t('pages.profile.tierFree') }}</span>
                <span
                  v-else
                  class="inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/12 text-amber-200 border border-amber-400/25"
                >{{ t('pages.profile.tierVip') }}</span>
                <p class="text-xs text-gray-500 leading-snug">{{ membershipExpiry }}</p>
                <p v-if="!isVip" class="text-sm text-gold-200/90 font-medium">{{ t('pages.profile.readsLeft', { count: remaining }) }}</p>
              </div>
            </div>
          </aside>
        </div>

        <!-- Avatar Picker (inline) -->
        <Transition name="dropdown">
          <div v-if="showAvatarPicker" class="mt-6 pt-6 border-t border-gold-500/10">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p class="text-gray-300 text-sm font-medium">{{ t('pages.profile.pickAvatar') }}</p>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-500/10 border border-gold-500/30 text-gold-300 text-xs hover:bg-gold-500/20 transition-colors disabled:opacity-50"
                @click="triggerFileUpload"
                :disabled="avatarUploading"
              >
                <LoaderCircle v-if="avatarUploading" class="w-3.5 h-3.5 animate-spin shrink-0" :size="14" />
                <Upload v-else class="w-3.5 h-3.5 shrink-0" :size="14" />
                {{ avatarUploading ? t('pages.profile.uploading') : t('pages.profile.uploadAvatar') }}
              </button>
              <input
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                class="hidden"
                @change="handleFileChange"
              />
            </div>
            <p v-if="avatarError" class="text-red-400 text-xs mb-2">{{ avatarError }}</p>
            <div class="grid grid-cols-4 sm:grid-cols-8 gap-2.5 sm:gap-3 max-w-md sm:max-w-none mx-auto sm:mx-0">
              <button
                v-for="emoji in avatarOptions"
                :key="emoji"
                type="button"
                class="text-2xl w-11 h-11 flex items-center justify-center rounded-xl border transition-all"
                :class="user.avatar === emoji ? 'border-gold-500 bg-gold-500/10 shadow-lg shadow-gold-500/20' : 'border-gold-500/10 hover:border-gold-500/50 bg-white/4'"
                @click="selectAvatar(emoji)"
              >
                {{ emoji }}
              </button>
            </div>
            <p class="text-gray-500 text-xs mt-2">{{ t('pages.profile.avatarHint') }}</p>
          </div>
        </Transition>
      </div>

      <!-- Main Content Grid：主栏 + 大屏粘性侧栏 -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-10 items-start">
        <!-- Left Column: Profile Details -->
        <div class="xl:col-span-7 space-y-6 xl:space-y-8 min-w-0">

          <!-- Profile Details Card -->
          <div class="card-panel rounded-2xl p-6 sm:p-7 profile-section-card">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-5 pb-3 border-b border-gold-500/10">
              <h3 class="text-white font-semibold font-serif text-lg tracking-wide inline-flex items-center gap-2.5">
                <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500/12 ring-1 ring-gold-500/15 text-gold-400/90">
                  <UserRound :size="18" />
                </span>
                {{ t('pages.profile.sectionProfile') }}
              </h3>
              <span class="text-gray-600 text-xs sm:text-right">{{ t('pages.profile.profileHint') }}</span>
            </div>

            <dl class="divide-y divide-white/5">
            <!-- Membership expiry -->
            <div class="profile-field-row grid grid-cols-1 gap-1 py-3.5 sm:grid-cols-[minmax(7rem,10rem)_1fr] sm:gap-x-6 sm:items-center">
              <dt class="text-gray-500 text-sm">{{ t('pages.profile.membershipExpiry') }}</dt>
              <dd class="min-w-0 sm:text-right">
                <span class="text-sm" :class="user.membership === 'vip' ? 'text-yellow-400' : 'text-gray-500'">{{ membershipExpiry }}</span>
              </dd>
            </div>

            <!-- Gender (editable) -->
            <div class="profile-field-row grid grid-cols-1 gap-1 py-3.5 sm:grid-cols-[minmax(7rem,10rem)_1fr] sm:gap-x-6 sm:items-center">
              <dt class="text-gray-500 text-sm">{{ t('pages.profile.gender') }}</dt>
              <dd class="min-w-0 sm:flex sm:justify-end sm:items-center">
              <div v-if="editingField === 'gender'" class="flex flex-wrap items-center gap-2 justify-end">
                <select
                  class="px-3 py-1.5 rounded-lg bg-white/4 border border-gold-500/10 text-gray-300 text-sm focus:border-gold-400 focus:outline-none min-w-[8rem]"
                  :value="user.gender"
                  @change="saveGender(($event.target as HTMLSelectElement).value)"
                >
                  <option value="unset">{{ t('pages.profile.genderUnset') }}</option>
                  <option value="male">{{ t('pages.profile.genderMale') }}</option>
                  <option value="female">{{ t('pages.profile.genderFemale') }}</option>
                  <option value="other">{{ t('pages.profile.genderOther') }}</option>
                </select>
                <button type="button" class="text-gray-500 hover:text-gray-300 text-xs" @click="cancelEdit">{{ t('pages.profile.cancel') }}</button>
              </div>
              <button v-else type="button" class="text-gray-300 text-sm hover:text-gold-400 transition-colors inline-flex items-center gap-1 sm:ml-auto" @click="editingField = 'gender'">
                {{ genderLabel(user.gender) }}
                <ChevronRight class="w-3.5 h-3.5 text-gray-600" :size="14" />
              </button>
              </dd>
            </div>

            <!-- Birthday (read-only, managed in dedicated section below) -->
            <div class="profile-field-row grid grid-cols-1 gap-1 py-3.5 sm:grid-cols-[minmax(7rem,10rem)_1fr] sm:gap-x-6 sm:items-center">
              <dt class="text-gray-500 text-sm">{{ t('pages.profile.birthday') }}</dt>
              <dd class="min-w-0 sm:text-right text-gray-300 text-sm inline-flex flex-wrap items-center gap-x-1 justify-start sm:justify-end">
                <span>{{ formattedBirthday || t('pages.profile.unset') }}</span>
                <span v-if="user.zodiacSign" class="text-gold-400">{{ user.zodiacSign }}</span>
              </dd>
            </div>

            <!-- Location (editable) -->
            <div class="profile-field-row grid grid-cols-1 gap-1 py-3.5 sm:grid-cols-[minmax(7rem,10rem)_1fr] sm:gap-x-6 sm:items-center">
              <dt class="text-gray-500 text-sm">{{ t('pages.profile.location') }}</dt>
              <dd class="min-w-0 sm:flex sm:justify-end sm:items-center">
              <div v-if="editingField === 'location'" class="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <input
                  v-model="editValue"
                  type="text"
                  :placeholder="t('pages.profile.locationPh')"
                  class="w-full sm:max-w-[14rem] px-3 py-1.5 rounded-lg bg-white/4 border border-gold-500/10 text-gray-300 text-sm focus:border-gold-400 focus:outline-none"
                  @keyup.enter="saveField('location')"
                />
                <div class="flex gap-2 shrink-0">
                  <button type="button" class="text-green-400 hover:text-green-300 text-xs" @click="saveField('location')">{{ t('pages.profile.save') }}</button>
                  <button type="button" class="text-gray-500 hover:text-gray-300 text-xs" @click="cancelEdit">{{ t('pages.profile.cancel') }}</button>
                </div>
              </div>
              <button v-else type="button" class="text-gray-300 text-sm hover:text-gold-400 transition-colors inline-flex items-center gap-1 sm:ml-auto text-left sm:text-right" @click="startEdit('location', user.location)">
                {{ user.location || t('pages.profile.unset') }}
                <ChevronRight class="w-3.5 h-3.5 text-gray-600 shrink-0" :size="14" />
              </button>
              </dd>
            </div>

            <!-- Bio (editable) -->
            <div class="profile-field-row grid grid-cols-1 gap-2 py-3.5 sm:grid-cols-[minmax(7rem,10rem)_1fr] sm:gap-x-6 sm:items-start">
              <dt class="text-gray-500 text-sm pt-0.5">{{ t('pages.profile.bio') }}</dt>
              <dd class="min-w-0 w-full">
              <div v-if="editingField === 'bio'">
                <textarea
                  v-model="editValue"
                  rows="3"
                  maxlength="200"
                  :placeholder="t('pages.profile.bioPh')"
                  class="w-full px-3 py-2 rounded-lg bg-white/4 border border-gold-500/10 text-gray-300 text-sm focus:border-gold-400 focus:outline-none resize-none"
                ></textarea>
                <div class="flex flex-col-reverse gap-2 mt-2 sm:flex-row sm:items-center sm:justify-between">
                  <span class="text-gray-600 text-xs">{{ editValue.length }}/200</span>
                  <div class="flex gap-2">
                    <button type="button" class="text-green-400 hover:text-green-300 text-xs" @click="saveField('bio')">{{ t('pages.profile.save') }}</button>
                    <button type="button" class="text-gray-500 hover:text-gray-300 text-xs" @click="cancelEdit">{{ t('pages.profile.cancel') }}</button>
                  </div>
                </div>
              </div>
              <button v-else type="button" class="text-gray-300 text-sm hover:text-gold-400 transition-colors w-full inline-flex items-start gap-1 text-left" @click="startEdit('bio', user.bio)">
                <span class="min-w-0 flex-1 line-clamp-3 break-words">{{ user.bio || t('pages.profile.unset') }}</span>
                <ChevronRight class="w-3.5 h-3.5 text-gray-600 shrink-0 mt-0.5" :size="14" />
              </button>
              </dd>
            </div>
            </dl>
          </div>

          <!-- Birth Info Card (dedicated section) -->
          <div class="card-panel rounded-2xl p-6 sm:p-7 profile-section-card">
            <div class="mb-5 pb-3 border-b border-gold-500/10">
              <h3 class="text-white font-semibold font-serif text-lg tracking-wide inline-flex items-center gap-2.5">
                <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/12 ring-1 ring-violet-400/15 text-violet-300/90">
                  <Calendar :size="18" />
                </span>
                {{ t('pages.profile.sectionBirth') }}
              </h3>
              <p class="text-gray-600 text-xs mt-1.5 leading-relaxed">{{ t('pages.profile.birthSectionHint') }}</p>
            </div>

            <div
              v-if="birthLoading"
              class="flex items-center justify-center gap-2 text-gray-500 text-sm py-8"
              role="status"
              :aria-busy="true"
              :aria-label="t('pages.profile.birthLoading')"
            >
              <LoaderCircle class="w-5 h-5 animate-spin shrink-0 text-gold-400/70" :size="20" />
              <span>{{ t('pages.profile.birthLoading') }}</span>
            </div>

            <div v-else class="space-y-5">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                <div>
                  <label class="text-gray-500 text-sm block mb-1.5" for="profile-birth-date">{{ t('pages.profile.birthDateLabel') }}</label>
                  <input
                    id="profile-birth-date"
                    v-model="birthDateInput"
                    type="date"
                    class="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-gold-500/12 text-gray-200 text-sm focus:border-gold-400/80 focus:outline-none focus:ring-2 focus:ring-gold-500/15 transition-colors color-scheme-dark"
                  />
                </div>
                <div class="rounded-xl border border-gold-500/10 bg-white/[0.02] px-4 py-3 flex flex-col justify-center min-h-[4.5rem]">
                  <span class="text-gray-500 text-xs mb-1">{{ t('pages.profile.zodiac') }}</span>
                  <span class="text-gold-400 text-base font-semibold font-serif tracking-wide">{{ birthZodiac || '—' }}</span>
                </div>
              </div>

              <!-- Action buttons -->
              <div class="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3 pt-1">
                <button
                  type="button"
                  class="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 text-abyss text-sm font-medium transition-all hover:shadow-lg hover:shadow-gold-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="birthSaving"
                  @click="saveBirthInfo"
                >
                  {{ birthSaving ? t('pages.profile.birthSaving') : t('pages.profile.birthSave') }}
                </button>
                <button
                  type="button"
                  class="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-white/10 text-gray-400 text-sm hover:bg-white/4 hover:text-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="birthSaving || !birthBirthday"
                  @click="clearBirthInfo"
                >
                  {{ t('pages.profile.birthClear') }}
                </button>
              </div>

              <!-- Feedback message -->
              <p v-if="birthMsg" class="text-xs" :class="birthMsgType === 'success' ? 'text-green-400' : 'text-red-400'">
                {{ birthMsg }}
              </p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              class="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/35 text-red-400/95 hover:bg-red-500/10 font-medium transition-all"
              @click="handleLogout"
            >
              <LogOut :size="18" />
              {{ t('pages.profile.logout') }}
            </button>
            <RouterLink
              to="/"
              class="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-gold-500/15 text-gray-200 hover:bg-gold-500/5 hover:border-gold-500/25 font-medium transition-all text-center"
            >
              <House :size="18" class="text-gold-400/80" />
              {{ t('pages.profile.backHome') }}
            </RouterLink>
          </div>
        </div>

        <!-- Right Sidebar：合并为单卡 + 大屏粘性 -->
        <aside class="xl:col-span-5 min-w-0 xl:sticky xl:top-24 xl:self-start xl:z-10">
          <div class="card-glass rounded-2xl overflow-hidden shadow-xl shadow-black/25">
            <!-- Invitation -->
            <section class="p-6 sm:p-7 border-b border-gold-500/10">
            <h3 class="text-gold-100/95 font-semibold font-serif mb-1 inline-flex items-center gap-2">
              <Ticket :size="18" class="text-gold-400/85 shrink-0" />
              {{ t('pages.profile.inviteTitle') }}
            </h3>
            <p class="text-gray-600 text-xs mb-4 leading-relaxed">{{ t('pages.profile.inviteHint') }}</p>
            <div class="flex flex-col gap-2">
              <input
                v-model="invitationCode"
                type="text"
                :placeholder="t('pages.profile.invitePh')"
                :aria-label="t('pages.profile.inviteAria')"
                class="w-full min-w-0 px-3 py-2.5 rounded-lg bg-white/5 border border-gold-500/12 text-white text-sm placeholder:text-stone-500/75 focus:border-gold-400/80 focus:outline-none focus:ring-2 focus:ring-gold-500/15"
                @keyup.enter="redeemInvitation"
              />
              <button
                type="button"
                class="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 text-abyss text-sm font-semibold transition-all hover:shadow-lg hover:shadow-gold-500/25"
                @click="redeemInvitation"
              >
                <Ticket :size="16" class="opacity-90" />
                {{ t('pages.profile.redeem') }}
              </button>
            </div>
            <p v-if="invitationMsg" class="text-xs mt-2" :class="invitationSuccess ? 'text-green-400' : 'text-red-400'">
              {{ invitationMsg }}
            </p>
            </section>

            <!-- Quick Links -->
            <section class="p-6 sm:p-7">
            <h3 class="text-gold-100/95 font-semibold font-serif mb-1 inline-flex items-center gap-2">
              <Sparkles :size="18" class="text-gold-400/85 shrink-0" />
              {{ t('pages.profile.shortcutsTitle') }}
            </h3>
            <p class="text-gray-600 text-xs mb-4">{{ t('pages.profile.shortcutsHint') }}</p>
            <nav class="space-y-1" :aria-label="t('pages.profile.shortcutsNavAria')">
              <RouterLink
                to="/history"
                class="profile-quick-link flex items-center gap-3 px-3 py-3 rounded-xl text-gray-300 hover:text-gold-100 transition-colors border border-transparent hover:border-gold-500/10 hover:bg-white/4"
              >
                <span class="w-9 h-9 rounded-xl bg-gold-500/12 flex items-center justify-center ring-1 ring-gold-500/10 text-gold-300/90">
                  <History :size="18" />
                </span>
                <span class="text-sm font-medium">{{ t('pages.profile.shortcutHistory') }}</span>
                <ChevronRight class="w-4 h-4 text-gray-600 ml-auto shrink-0" :size="16" />
              </RouterLink>
              <RouterLink
                to="/card-back-settings"
                class="profile-quick-link flex items-center gap-3 px-3 py-3 rounded-xl text-gray-300 hover:text-gold-100 transition-colors border border-transparent hover:border-gold-500/10 hover:bg-white/4"
              >
                <span class="w-9 h-9 rounded-xl bg-mystic/15 flex items-center justify-center ring-1 ring-mystic/20 text-violet-200/90">
                  <Images :size="18" />
                </span>
                <span class="text-sm font-medium">{{ t('pages.profile.shortcutCardBack') }}</span>
                <ChevronRight class="w-4 h-4 text-gray-600 ml-auto shrink-0" :size="16" />
              </RouterLink>
              <RouterLink
                to="/feedback"
                class="profile-quick-link flex items-center gap-3 px-3 py-3 rounded-xl text-gray-300 hover:text-gold-100 transition-colors border border-transparent hover:border-gold-500/10 hover:bg-white/4"
              >
                <span class="w-9 h-9 rounded-xl bg-celestial/12 flex items-center justify-center ring-1 ring-celestial/15 text-sky-200/90">
                  <MessageSquare :size="18" />
                </span>
                <span class="text-sm font-medium">{{ t('pages.profile.shortcutFeedback') }}</span>
                <ChevronRight class="w-4 h-4 text-gray-600 ml-auto shrink-0" :size="16" />
              </RouterLink>
            </nav>
            </section>
          </div>
        </aside>
      </div>

    </div>
  </div>
</template>

<style scoped>
.profile-page {
  background:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124, 58, 237, 0.08), transparent 55%),
    radial-gradient(ellipse 60% 40% at 100% 0%, rgba(212, 168, 83, 0.04), transparent 45%);
}
.profile-hero-card {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}
.profile-section-card {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
.profile-side-card {
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
}
.profile-quick-link:focus-visible {
  outline: 2px solid rgba(212, 168, 83, 0.65);
  outline-offset: 2px;
}
</style>
