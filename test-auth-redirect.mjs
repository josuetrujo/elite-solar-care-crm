import assert from 'node:assert/strict'
import {
  isPasswordResetLocation,
  passwordResetRedirect,
} from './src/lib/authUrls.js'

const production = {
  origin: 'https://josuetrujo.github.io',
  pathname: '/elite-solar-care-crm/',
  search: '',
  hash: '#/forgot',
}

assert.equal(
  passwordResetRedirect(production),
  'https://josuetrujo.github.io/elite-solar-care-crm/?reset=1',
  'reset marker must use the query string so Supabase owns the fragment',
)

assert.equal(isPasswordResetLocation({
  search: '?reset=1',
  hash: '#access_token=temporary&type=recovery',
}), true)

assert.equal(isPasswordResetLocation({
  search: '',
  hash: '#/reset',
}), true, 'legacy reset screen remains recognized')

assert.equal(isPasswordResetLocation({
  search: '',
  hash: '#/customers',
}), false)

console.log('all auth redirect checks passed')
