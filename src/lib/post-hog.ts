// Validate PostHog env variables
const posthogKeys = {
  apiKey: import.meta.env.VITE_POSTHOG_KEY,
  host: import.meta.env.VITE_POSTHOG_HOST,
}

if (!posthogKeys.apiKey || !posthogKeys.host) {
  throw new Error('PostHog API key or host is not set')
}

export { posthogKeys }
