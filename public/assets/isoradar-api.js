/* ==========================================================================
   ISO Radar — API address and session renewal, loaded first on every page.

   • window.IR_API_ORIGIN is the single place the backend address lives
     (pages build their API base from it).
   • Access tokens are short-lived. Every fetch to the API that carries a
     bearer token is renewed transparently: just before expiry, or once on
     a 401, the refresh token is exchanged at /auth/refresh and the request
     is retried with the new token.
   • Refresh tokens are single-use and a replayed one ends every session, so
     renewal runs under a cross-tab lock and is skipped when another tab has
     already renewed.
   • Tokens returned by login / register / refresh are stored here, so every
     page keeps its refresh token without its own code for it.
   ========================================================================== */
(function () {
  'use strict';
  var ORIGIN = 'https://ims-qhse-backend-production.up.railway.app';
  window.IR_API_ORIGIN = window.IR_API_ORIGIN || ORIGIN;

  var KEY = 'ims_token', RKEY = 'ims_refresh_token';
  var nativeFetch = window.fetch.bind(window);

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }

  function expiresSoon(token) {
    try {
      var p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return p.exp * 1000 - Date.now() < 30000;
    } catch (e) { return false; }
  }

  function store(d) {
    if (!d || !d.access_token) return;
    set(KEY, d.access_token);
    if (d.refresh_token) set(RKEY, d.refresh_token);
  }

  function withLock(fn) {
    return navigator.locks && navigator.locks.request ? navigator.locks.request('ir-token-refresh', fn) : fn();
  }

  var inflight = null;
  function refresh(usedToken) {
    if (inflight) return inflight;
    inflight = Promise.resolve(withLock(async function () {
      var now = get(KEY);
      if (now && now !== usedToken && !expiresSoon(now)) return true; // already renewed elsewhere
      var rt = get(RKEY);
      if (!rt) return false;
      try {
        var r = await nativeFetch(window.IR_API_ORIGIN + '/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
        });
        if (!r.ok) { if (r.status === 401) set(RKEY, null); return false; }
        var j = await r.json();
        store(j && j.data ? j.data : j);
        return true;
      } catch (e) { return false; }
    })).finally(function () { inflight = null; });
    return inflight;
  }

  function bearerOf(init) {
    var h = init && init.headers;
    if (!h) return null;
    var v = typeof h.get === 'function' ? h.get('Authorization') : (h.Authorization || h.authorization);
    return v && /^Bearer /.test(v) ? v.slice(7) : null;
  }

  function withToken(init, token) {
    var h = init.headers, copy;
    if (typeof h.get === 'function') { copy = new Headers(h); copy.set('Authorization', 'Bearer ' + token); }
    else { copy = Object.assign({}, h); delete copy.authorization; copy.Authorization = 'Bearer ' + token; }
    return Object.assign({}, init, { headers: copy });
  }

  window.fetch = async function (input, init) {
    var url = typeof input === 'string' ? input : (input instanceof URL ? input.href : null);
    if (!url || url.indexOf(window.IR_API_ORIGIN) !== 0) return nativeFetch(input, init);

    if (/\/auth\/(login|register|refresh)$/.test(url.split('?')[0])) {
      var authRes = await nativeFetch(input, init);
      if (authRes.ok) authRes.clone().json().then(function (j) { store(j && j.data ? j.data : j); }).catch(function () {});
      return authRes;
    }

    var used = bearerOf(init);
    if (!used) return nativeFetch(input, init);
    var token = get(KEY) || used;
    if (expiresSoon(token) && get(RKEY)) { await refresh(token); token = get(KEY) || token; }

    var res = await nativeFetch(input, withToken(init, token));
    if (res.status !== 401 || !get(RKEY)) return res;
    if (!(await refresh(token))) return res;
    return nativeFetch(input, withToken(init, get(KEY)));
  };
})();
