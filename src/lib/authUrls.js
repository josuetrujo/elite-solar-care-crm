// Supabase's implicit auth flow delivers the temporary recovery session in the
// URL fragment (`#access_token=...`). The app uses HashRouter for normal pages,
// so the password-reset marker must live in the query string instead. Putting
// both in the fragment makes the recovery session disappear before updateUser.
export function passwordResetRedirect(location = window.location) {
  const url = new URL(location.pathname, location.origin)
  url.searchParams.set('reset', '1')
  return url.toString()
}

export function isPasswordResetLocation(location = window.location) {
  const params = new URLSearchParams(location.search || '')
  // Keep the old hash check so an already-open reset screen remains usable
  // when it has a valid stored session. New emails always use ?reset=1.
  return params.get('reset') === '1' || (location.hash || '').startsWith('#/reset')
}

export function clearPasswordResetLocation(location = window.location, history = window.history) {
  const url = new URL(location.href)
  url.searchParams.delete('reset')
  url.hash = '#/'
  history.replaceState(history.state, '', url.toString())
}
