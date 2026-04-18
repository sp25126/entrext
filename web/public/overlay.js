(function() {
  'use strict';

  // ─── Selector Stability Score System ───────────────────────────────────────
  function generateSelector(el) {
    if (!el || el.nodeType !== 1) return { selector: 'unknown', score: 0 };

    const strategies = [
      // Strategy 1: data-testid (score: 100 — most stable)
      () => {
        const v = el.getAttribute('data-testid') || el.getAttribute('data-cy') || el.getAttribute('data-test');
        return v ? { selector: `[data-testid="${v}"]`, score: 100 } : null;
      },
      // Strategy 2: aria-label (score: 95 — accessibility-driven)
      () => {
        const v = el.getAttribute('aria-label');
        return v ? { selector: `[aria-label="${v.slice(0, 60).replace(/"/g, '\\"')}"]`, score: 95 } : null;
      },
      // Strategy 3: unique ID (score: 90 — stable if not auto-gen)
      () => {
        const id = el.id;
        if (!id || /^\d|[0-9]{4,}/.test(id) || id.length > 30) return null;
        try {
          const unique = document.querySelectorAll(`#${CSS.escape(id)}`).length === 1;
          return unique ? { selector: `#${CSS.escape(id)}`, score: 90 } : null;
        } catch { return null; }
      },
      // Strategy 4: semantic tag + non-utility class (score: 70)
      () => {
        const tag = el.tagName.toLowerCase();
        const utilityPattern = /^(mt|mb|ml|mr|pt|pb|pl|pr|px|py|mx|my|w-|h-|text-|bg-|flex|grid|gap|p-|m-|rounded|border|shadow|z-|top|left|right|bottom|absolute|relative|fixed|hidden|block|inline|overflow|cursor|select|pointer|transition|duration|ease)/;
        const classes = [...el.classList].filter(c => c.length > 2 && !utilityPattern.test(c));
        if (!classes.length) return null;
        const candidate = `${tag}.${CSS.escape(classes[0])}`;
        try {
          return document.querySelectorAll(candidate).length === 1
            ? { selector: candidate, score: 70 } : null;
        } catch { return null; }
      },
      // Strategy 5: structural path (score: 40 — fragile)
      () => {
        const parts = [];
        let node = el;
        while (node && node !== document.body && parts.length < 5) {
          let part = node.tagName.toLowerCase();
          if (node.parentElement) {
            const siblings = [...node.parentElement.children].filter(s => s.tagName === node.tagName);
            if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
          }
          parts.unshift(part);
          node = node.parentElement;
        }
        return { selector: parts.join(' > '), score: 40 };
      }
    ];

    for (const strategy of strategies) {
      try {
        const result = strategy();
        if (result) return result;
      } catch { continue; }
    }
    return { selector: el.tagName.toLowerCase(), score: 10 };
  }

  // ─── Session Recorder (Zero-Impact Passive) ───────────────────────────────
  const session = {
    events: [],
    clickCounts: {},    // { selector: [timestamps] }
    hoverTimers: {},    // { selector: timeoutID }
    
    record(type, data) {
      this.events.push({ type, t: Date.now(), ...data });
      if (this.events.length > 500) this.events.shift(); // Memory cap
    },

    trackRageClick(selector) {
      const now = Date.now();
      if (!this.clickCounts[selector]) this.clickCounts[selector] = [];
      this.clickCounts[selector] = this.clickCounts[selector].filter(t => now - t < 1500);
      this.clickCounts[selector].push(now);
      
      if (this.clickCounts[selector].length >= 3) {
        this.record('RAGE_CLICK', { selector, count: this.clickCounts[selector].length });
        this.clickCounts[selector] = []; // Reset after detection
        return true;
      }
      return false;
    },

    startHover(selector) {
      this.hoverTimers[selector] = setTimeout(() => {
        this.record('HESITATION', { selector, duration: 2500 });
      }, 2500);
    },

    endHover(selector) {
      if (this.hoverTimers[selector]) {
        clearTimeout(this.hoverTimers[selector]);
        delete this.hoverTimers[selector];
      }
    },

    getSummary() {
      const rage = this.events.filter(e => e.type === 'RAGE_CLICK');
      const hesitation = this.events.filter(e => e.type === 'HESITATION');
      return { 
        rageClicks: rage, 
        hesitations: hesitation, 
        totalEvents: this.events.length,
        events: this.events 
      };
  };
  
  let designSystem = null;
  // Receive design system config from parent
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'DESIGN_SYSTEM_CONFIG') {
      designSystem = e.data.config;
      console.log('[Entrext] Design system loaded:', designSystem);
    }
  });

  function normalizeColor(raw) {
    if (!raw) return '';
    const m = raw.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!m) return raw.toLowerCase();
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  function checkDesignSystemViolations(el) {
    if (!el || !designSystem) return [];
    const style = getComputedStyle(el);
    const violations = [];
    
    // Check background color
    const bg = normalizeColor(style.backgroundColor);
    if (bg && bg !== 'rgba(0,0,0,0)' && bg !== 'transparent' && designSystem.colors?.length > 0) {
      if (!designSystem.colors.map(c => c.toLowerCase()).includes(bg)) {
        violations.push({ type: 'color', property: 'background-color', value: bg, message: `Background ${bg} not in design system` });
      }
    }
    
    // Check font family
    const font = style.fontFamily.split(',')[0].trim().replace(/["']/g, '');
    if (designSystem.fonts?.length > 0 && !designSystem.fonts.some(f => font.includes(f))) {
      violations.push({ type: 'font', property: 'font-family', value: font, message: `Font "${font}" not in design system` });
    }
    
    // Check border radius
    const radius = style.borderRadius;
    if (radius && radius !== '0px' && designSystem.borderRadii?.length > 0) {
      if (!designSystem.borderRadii.includes(radius)) {
        violations.push({ type: 'borderRadius', property: 'border-radius', value: radius, message: `Border radius ${radius} not in design system` });
      }
    }
    return violations;
  }

  let isCtrlHeld = false;
  let modeBadge = null;

  function showBadge() {
    if (modeBadge) return;
    modeBadge = document.createElement('div');
    modeBadge.textContent = '⚡ FEEDBACK MODE — Ctrl+Click to annotate';
    modeBadge.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#a855f7;color:#fff;padding:6px 16px;border-radius:9999px;font-size:12px;font-family:monospace;z-index:2147483647;pointer-events:none;transition:opacity 0.2s;box-shadow:0 4px 20px rgba(168,85,247,0.4)';
    document.body.appendChild(modeBadge);
  }

  function hideBadge() {
    if (modeBadge) { modeBadge.remove(); modeBadge = null; }
  }

  // ─── Interaction Wiring ────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Control') {
      isCtrlHeld = true;
      showBadge();
      window.parent.postMessage({ type: 'MODE_CHANGED', mode: 'feedback' }, '*');
    }
  });

  document.addEventListener('keyup', e => {
    if (e.key === 'Control') {
      isCtrlHeld = false;
      hideBadge();
      const old = document.getElementById('__entrext_hover');
      if (old) old.remove();
      window.parent.postMessage({ type: 'MODE_CHANGED', mode: 'browse' }, '*');
    }
  });

  document.addEventListener('mouseover', e => {
    const el = e.target;
    if (!el || el.nodeType !== 1) return;
    const { selector } = generateSelector(el);
    
    if (isCtrlHeld) {
      const old = document.getElementById('__entrext_hover');
      if (old) old.remove();
      const rect = el.getBoundingClientRect();
      const highlight = document.createElement('div');
      highlight.id = '__entrext_hover';
      highlight.style.cssText = `position:fixed;pointer-events:none;z-index:2147483646;border:2px dashed #a855f7;border-radius:4px;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;transition:all 0.1s`;
      document.body.appendChild(highlight);
      
      const violations = checkDesignSystemViolations(el);
      if (violations.length > 0) {
        const badge = document.createElement('div');
        badge.id = '__entrext_ds_badge';
        badge.textContent = `⚠ DS: ${violations[0].message}`;
        badge.style.cssText = `position:fixed;z-index:2147483647;background:#ef4444;color:white;font-size:10px;font-weight:bold;padding:4px 10px;border-radius:6px;pointer-events:none;top:${rect.bottom + 6}px;left:${rect.left}px;font-family:monospace;box-shadow:0 4px 12px rgba(239,68,68,0.3)`;
        document.body.appendChild(badge);
      }
    } else {
      session.startHover(selector);
    }
  });

  document.addEventListener('mouseout', e => {
    const el = e.target;
    if (!el || el.nodeType !== 1) return;
    const { selector } = generateSelector(el);
    session.endHover(selector);
    const badge = document.getElementById('__entrext_ds_badge');
    if (badge) badge.remove();
  });

  document.addEventListener('click', e => {
    const el = e.target;
    const selectorResult = generateSelector(el);
    
    // Recording
    session.record('CLICK', { selector: selectorResult.selector, x: e.clientX, y: e.clientY });
    session.trackRageClick(selectorResult.selector);

    if (!isCtrlHeld) return;
    
    e.preventDefault();
    e.stopPropagation();

    const label = (el.textContent || el.getAttribute('alt') || el.tagName || '').trim().slice(0, 50);
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;

    const sendMessage = (screenshot) => {
      window.parent.postMessage({
        type: 'FEEDBACK_CLICK',
        selector: selectorResult.selector,
        selectorScore: selectorResult.score,
        elementLabel: label,
        tagName: el.tagName,
        pageUrl: window.location.href,
        x, y,
        screenshot: screenshot || null,
        sessionSummary: session.getSummary(),
        designViolations: checkDesignSystemViolations(el)
      }, '*');
    };

    if (window.html2canvas) {
      window.html2canvas(el, { scale: 1.5, backgroundColor: null, logging: false, useCORS: true })
        .then(c => sendMessage(c.toDataURL('image/png')))
        .catch(() => sendMessage(null));
    } else {
      sendMessage(null);
    }
  }, true);

  document.addEventListener('scroll', () => {
    session.record('SCROLL', { y: window.scrollY });
  }, { passive: true });

  console.log('[Entrext Overlay] V2 Engine Initialized | Multi-Strategy Stability Scoring & Session Recording Active ✓');
})();
