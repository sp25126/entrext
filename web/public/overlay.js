(function() {
  'use strict';

  function generateSelector(el) {
    try {
      // Guard: reject non-element nodes
      if (!el || el.nodeType !== 1) return 'unknown'

      // 1. data-testid / data-cy (safe access via getAttribute, not dataset)
      const testId = el.getAttribute('data-testid') || el.getAttribute('data-cy') || el.getAttribute('data-test')
      if (testId) return `[data-testid="${testId}"]`

      // 2. aria-label
      const aria = el.getAttribute('aria-label')
      if (aria) return `[aria-label="${aria.slice(0, 50)}"]`

      // 3. id (skip auto-generated: pure numbers, or >25 chars, or contains random patterns)
      if (el.id && el.id.length < 25 && !/^\d+$/.test(el.id) && !/[0-9]{4,}/.test(el.id)) {
        return `#${el.id}`
      }

      // 4. tag + class (filter out Tailwind utility classes)
      const tag = el.tagName.toLowerCase()
      const classes = Array.from(el.classList || [])
        .filter(c => c.length > 2 && !/^(mt|mb|ml|mr|pt|pb|pl|pr|px|py|mx|my|w-|h-|text-|bg-|flex|grid|gap|p-|m-|rounded|border|shadow|opacity|z-|top-|left-|right-|bottom-|absolute|relative|fixed|inline|block|hidden|overflow)/.test(c))
        .slice(0, 2)

      if (classes.length > 0) {
        const candidate = `${tag}.${classes.join('.')}`
        try {
          if (document.querySelectorAll(candidate).length === 1) return candidate
        } catch(e) {}
      }

      // 5. Structural fallback — minimal path
      const parts = []
      let node = el
      while (node && node.nodeType === 1 && parts.length < 4) {
        let selector = node.tagName.toLowerCase()
        if (node.parentElement) {
          const siblings = Array.from(node.parentElement.children).filter(s => s.tagName === node.tagName)
          if (siblings.length > 1) {
            selector += `:nth-of-type(${siblings.indexOf(node) + 1})`
          }
        }
        parts.unshift(selector)
        node = node.parentElement
        if (node && (node.id || node === document.body)) break
      }
      return parts.join(' > ') || tag
    } catch(e) {
      // Never crash the overlay — always return something
      return el?.tagName?.toLowerCase() || 'unknown'
    }
  }

  let isCtrlHeld = false
  let modeBadge = null

  function showBadge() {
    if (modeBadge) return
    modeBadge = document.createElement('div')
    modeBadge.id = '__entrext_badge'
    modeBadge.textContent = '⚡ FEEDBACK MODE — Ctrl+Click to annotate'
    modeBadge.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#a855f7;color:#fff;padding:6px 16px;border-radius:9999px;font-size:12px;font-family:monospace;z-index:2147483647;pointer-events:none;transition:opacity 0.2s'
    document.body.appendChild(modeBadge)
  }

  function hideBadge() {
    if (modeBadge) { modeBadge.remove(); modeBadge = null }
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Control') {
      isCtrlHeld = true
      showBadge()
      window.parent.postMessage({ type: 'MODE_CHANGED', mode: 'feedback' }, '*')
    }
  })

  document.addEventListener('keyup', e => {
    if (e.key === 'Control') {
      isCtrlHeld = false
      hideBadge()
      // Remove any hover outlines
      const old = document.getElementById('__entrext_hover')
      if (old) old.remove()
      window.parent.postMessage({ type: 'MODE_CHANGED', mode: 'browse' }, '*')
    }
  })

  document.addEventListener('mouseover', e => {
    if (!isCtrlHeld) return
    const old = document.getElementById('__entrext_hover')
    if (old) old.remove()
    const el = e.target
    if (!el || el.nodeType !== 1) return
    const rect = el.getBoundingClientRect()
    const highlight = document.createElement('div')
    highlight.id = '__entrext_hover'
    highlight.style.cssText = `position:fixed;pointer-events:none;z-index:2147483646;border:2px dashed #a855f7;border-radius:4px;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;transition:all 0.1s`
    document.body.appendChild(highlight)
  })

  document.addEventListener('click', e => {
    if (!isCtrlHeld) return
    e.preventDefault()
    e.stopPropagation()
    const el = e.target
    const selector = generateSelector(el)
    const label = (el.textContent || el.getAttribute('alt') || el.tagName || '').trim().slice(0, 50)
    const x = (e.clientX / window.innerWidth) * 100
    const y = (e.clientY / window.innerHeight) * 100

    // Try screenshot, but never block the postMessage if it fails
    const sendMessage = (screenshot) => {
      window.parent.postMessage({
        type: 'FEEDBACK_CLICK',
        selector,
        elementLabel: label,
        tagName: el.tagName,
        pageUrl: window.location.href,
        x, y,
        screenshot: screenshot || null
      }, '*')
    }

    if (window.html2canvas) {
      window.html2canvas(el, { scale: 1.5, backgroundColor: null, logging: false, useCORS: true })
        .then(c => sendMessage(c.toDataURL('image/png')))
        .catch(() => sendMessage(null))
    } else {
      sendMessage(null)
    }
  }, true)  // useCapture: true — fires before page's own click handlers

  console.log('[Entrext Overlay] Engine initialized ✓')
})()
