(function () {
  var config = window.HZ_ANALYTICS_CONFIG || {};
  var app = config.app || 'hit-zero';
  var debug = /[?&]analytics_debug=1\b/.test(window.location.search);
  var eventNames = new Set(['page_view','client_error','client_rejection','public_auth_mode_change','public_auth_result','public_auth_submit','public_auth_view','public_handoff_complete','public_invite_result','public_invite_submit','public_route_view','public_booking_result','public_booking_submit','public_booking_view','hz_public_auth_mode_selected','hz_public_auth_redirect','hz_public_auth_submit_result','hz_public_route_resolved','hz_public_booking_submit_attempt','hz_public_booking_submit_result','hz_public_checkout_handoff','checkout_submit','checkout_result']);
  var screens = new Set(['today','profile','program','billing','leads','roster','skills','routine','score','judge','arcade','evaluations','messages','announcements','schedule','volunteers','medical','birthdays','registration','book','pay','trial','drop-in','dropin','invite','signin','signup','reset','find-gym','owner']);
  var enumValues = new Set(['booking','payment','auth','invite','entry','form','link','manual','none','password','signup','reset','signin','parent','athlete','coach','owner','success','error','validation','blocked','load_error','reset_sent','confirm_email','mode_change','account_created','signed_in','square','invoice','registration','class_fetch','honeypot','too_fast','athlete_required','guardian_required','email_required','age_ineligible','missing_credentials','missing_signup_fields','missing_reset_identifier','COMPLETED','APPROVED','PENDING','FAILED','CANCELED','card_declined','payment_confirmation_pending','registration_sync_pending','checkout_access_required','payment_review_required','unknown']);
  var enumKeys = new Set(['flow','mode','auth_mode','prior_mode','requested_role','result','outcome','reason','stage','ui_state','view','invite_surface','status','code']);
  var boolKeys = new Set(['ok','retry','payment_required','will_invoice','existing','has_discount','discount_applied','public_checkout_enabled','checkout_enabled','registration_open','monthly','payment_link','invite_link','has_source_param']);
  var routeKeys = new Set(['route','route_base','prior_route','from_route','to_route','path','hash','hash_mode']);

  function isProdHost() {
    return !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(window.location.hostname || '');
  }

  function safeRoute(value) {
    var segment = String(value || '').split('?')[0].replace(/^\/?#?\/?/, '').split('/')[0].toLowerCase();
    return screens.has(segment) ? segment : 'other';
  }

  function route() {
    return safeRoute((window.location.hash || '').slice(1) || window.location.pathname);
  }

  function clean(value) {
    if (value == null) return undefined;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    return String(value).replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  function sanitize(props) {
    var out = { app: ['hit-zero','hit-zero-pwa','hit-zero-site'].includes(app) ? app : 'hit-zero', route: route() };
    Object.keys(props || {}).forEach(function (key) {
      var value=props[key];
      if (boolKeys.has(key) && typeof value==='boolean') out[key]=value;
      else if (enumKeys.has(key) && typeof value==='string' && enumValues.has(value)) out[key]=value;
      else if (routeKeys.has(key) && typeof value==='string') out[key]=safeRoute(value);
      else if (key==='duration_ms' && typeof value==='number' && Number.isFinite(value)) out[key]=Math.max(0,Math.min(600000,Math.round(value)));
    });
    return out;
  }

  function send(eventName, props) {
    if (!eventNames.has(eventName)) return;
    var safeName = eventName;
    var payload = sanitize(props);
    if (debug) console.info('[analytics]', safeName, payload);
    try {
      if (typeof window.va === 'function') window.va('event', safeName, payload);
    } catch (err) {}
    try {
      if (typeof window.clarity === 'function') window.clarity('event', safeName);
    } catch (err) {}
  }

  function markPage() {
    send('page_view', {
      path: window.location.pathname,
      hash: (window.location.hash || '#').split('?')[0],
      viewport: window.innerWidth + 'x' + window.innerHeight,
    });
  }

  function loadClarity() {
    var clarityId = clean(config.clarityId || '');
    if (config.privateApp || !clarityId || !isProdHost()) return;
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.clarity.ms/tag/' + encodeURIComponent(clarityId);
    document.head.appendChild(script);
  }

  function protectSensitiveScreens() {
    if (!config.privateApp) return;
    if (document.body) document.body.setAttribute('data-clarity-mask', 'true');
  }

  function protectFormFields() {
    var selector = [
      'input',
      'textarea',
      'select',
      '[contenteditable="true"]',
      '[data-sensitive]',
      '.sq-card-wrapper',
      '[id^="sq-card"]'
    ].join(',');
    document.querySelectorAll(selector).forEach(function (node) {
      node.setAttribute('data-clarity-mask', 'true');
    });
  }

  function attachErrorTracking() {
    window.addEventListener('error', function () { send('client_error', { code: 'unknown' }); });
    window.addEventListener('unhandledrejection', function () { send('client_rejection', { code: 'unknown' }); });
  }

  function init() {
    window.HZAnalytics = { track: send, page: markPage };
    window.va = window.va || function () {
      var queue=(window.vaq = window.vaq || []);
      if(queue.length>=200)queue.shift();
      queue.push(arguments);
    };
    protectSensitiveScreens();
    protectFormFields();
    loadClarity();
    // Explicit workflow events replace arbitrary DOM labels and link tracking.
    attachErrorTracking();
    markPage();
    window.addEventListener('hashchange', markPage);
    window.addEventListener('popstate', markPage);
    if (window.MutationObserver) {
      new MutationObserver(protectFormFields).observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
