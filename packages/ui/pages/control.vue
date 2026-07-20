<script setup lang="ts">
import {
  IconAdjustments,
  IconCloudUp,
  IconCpu,
  IconDeviceDesktop,
  IconFileCode,
  IconServerCog,
} from '@tabler/icons-vue'

const { t } = useI18n()

useHead({ title: computed(() => t('controlCenter')) })

const router = useRouter()
const endpointStore = useEndpointStore()
const { hasAgent, hasFeature, ready } = useControlInfo()
const { isDesktop, settings: desktopSettingsBridge } = useDesktop()

// The control center only exists in desktop/server (agent) mode. If a web user
// lands here directly (a hash URL or a stale defaultPage), bounce to the
// overview once the capability probe resolves — never flash an empty page.
watch(
  [ready, hasAgent],
  ([isReady, agent]) => {
    if (isReady && !agent) router.replace('/overview')
  },
  { immediate: true },
)

// Section visibility mirrors each panel's own capability gate so a section
// header never renders above an empty body.
const showKernel = computed(
  () =>
    hasFeature('kernel-control') ||
    hasFeature('kernel-version') ||
    hasFeature('geo-assets') ||
    hasFeature('logs-sse'),
)
const showSystem = computed(() => hasFeature('system-proxy'))
// Desktop-shell settings need the desktop preload bridge (never the web/server
// forms) — gate on the bridge surface, not an agent feature flag.
const showDesktop = computed(() => isDesktop && !!desktopSettingsBridge)
const showConfig = computed(
  () => hasFeature('config-sections') || hasFeature('runtime-config'),
)
const showBackup = computed(() => hasFeature('webdav-backup'))
</script>

<template>
  <div class="flex h-full flex-col gap-6 overflow-x-hidden overflow-y-auto p-2">
    <!-- Probe still resolving (or a web user mid-redirect): hold a spinner so
         neither the header nor an empty container flashes before we bounce. -->
    <div
      v-if="!ready || !hasAgent"
      class="flex h-64 items-center justify-center"
    >
      <span class="loading loading-lg loading-ring text-primary" />
    </div>

    <template v-else-if="hasAgent">
      <!-- Page header -->
      <div class="cc-fade-in flex items-center gap-3">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          <IconServerCog :size="24" />
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight">
            {{ t('controlCenter') }}
          </h1>
          <p class="text-xs opacity-60">
            {{ endpointStore.currentEndpoint?.url || t('controlCenterDesc') }}
          </p>
        </div>
      </div>

      <!-- Kernel: lifecycle, version/geo databases, process logs -->
      <section v-if="showKernel" class="cc-fade-in flex flex-col gap-4">
        <h2 class="cc-section-title">
          <IconCpu :size="16" />
          {{ t('controlCenterKernel') }}
        </h2>
        <KernelControlPanel />
        <KernelVersionPanel />
        <KernelLogView />
      </section>

      <!-- System integration: host-level proxy -->
      <section v-if="showSystem" class="cc-fade-in flex flex-col gap-4">
        <h2 class="cc-section-title">
          <IconDeviceDesktop :size="16" />
          {{ t('controlCenterSystem') }}
        </h2>
        <SystemProxyControlPanel />
      </section>

      <!-- Desktop shell: silent update check, TUN auto-restore, tray, hotkeys -->
      <section v-if="showDesktop" class="cc-fade-in flex flex-col gap-4">
        <h2 class="cc-section-title">
          <IconAdjustments :size="16" />
          {{ t('controlCenterDesktop') }}
        </h2>
        <DesktopSettingsPanel />
      </section>

      <!-- Configuration: profile network sections + live runtime config -->
      <section v-if="showConfig" class="cc-fade-in flex flex-col gap-4">
        <h2 class="cc-section-title">
          <IconFileCode :size="16" />
          {{ t('controlCenterConfig') }}
        </h2>
        <NetworkConfigPanel />
        <RuntimeConfigPanel />
      </section>

      <!-- Backup: WebDAV snapshot of profiles + dashboard settings -->
      <section v-if="showBackup" class="cc-fade-in flex flex-col gap-4">
        <h2 class="cc-section-title">
          <IconCloudUp :size="16" />
          {{ t('controlCenterBackup') }}
        </h2>
        <WebdavBackupPanel />
      </section>
    </template>
  </div>
</template>

<style scoped>
.cc-section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
}

.cc-fade-in {
  animation: cc-fade-in 380ms var(--ease-snappy) backwards;
}

@keyframes cc-fade-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
